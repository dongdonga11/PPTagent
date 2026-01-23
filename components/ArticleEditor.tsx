
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import TiptapEditor from './TiptapEditor';
import { transformToWechatHtml, THEMES } from '../utils/wechatStyleEngine';
import AssetLibrary from './AssetLibrary';
import CMSChatPanel from './CMSChatPanel';
import { getProfile, saveProfile, learnFromCorrection } from '../services/styleManager';
import { cmsAgentChat } from '../services/geminiService';
import { UserStyleProfile, CMSMessage, ResearchTopic } from '../types';
import { Editor } from '@tiptap/react';

interface ArticleEditorProps {
    content: string;
    onChange: (text: string) => void;
    onGenerateScript: () => void;
    isProcessing: boolean;
    topic?: ResearchTopic; // Full topic object
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ content, onChange, onGenerateScript, isProcessing, topic }) => {
    // --- STATE ---
    const [title, setTitle] = useState(topic?.title || "未命名创作");
    const [activeTheme, setActiveTheme] = useState('kaoxing'); 
    const [previewHtml, setPreviewHtml] = useState('');
    const [userProfile, setUserProfile] = useState<UserStyleProfile>(getProfile());
    
    // UI Toggles
    const [showAssetLib, setShowAssetLib] = useState(false);
    const [showStyleSettings, setShowStyleSettings] = useState(false);
    
    // Agent State
    const [messages, setMessages] = useState<CMSMessage[]>([]);
    const [isAgentTyping, setIsAgentTyping] = useState(false);
    const [currentSelection, setCurrentSelection] = useState('');
    
    // Editor Ref
    const editorRef = useRef<Editor | null>(null);

    // --- EFFECTS ---

    // 1. Proactive Agent Initialization (Simulated Speed)
    useEffect(() => {
        if (topic && messages.length === 0) {
            // "Fake" instantaneous response to improve perceived latency
            const initMessage = `已为您读取关于【${topic.title}】的 5 篇热点文章。基于您的【${userProfile.tone}】风格，我为您构思了以下 3 个切入点，您想用哪个？`;
            
            const agentMsg: CMSMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: initMessage,
                timestamp: Date.now(),
                uiOptions: [
                    { label: '🔥 痛点切入 (制造焦虑)', value: 'angle_pain' },
                    { label: '📖 故事切入 (反直觉案例)', value: 'angle_story' },
                    { label: '📊 干货切入 (实操盘点)', value: 'angle_data' }
                ]
            };
            setMessages([agentMsg]);
        }
    }, [topic, userProfile]);

    // 2. Selection Listener -> UI Feedback
    useEffect(() => {
        if (currentSelection.length > 5) {
             // We don't spam the chat, but we visually indicate context is active
             // In a real app, we might float a bubble. 
             // Here, we rely on the User to type "Refine this" or use a tool.
             console.log("Agent Context Update: Selection Active", currentSelection.substring(0, 10));
        }
    }, [currentSelection]);

    // 3. Preview Update
    useEffect(() => {
        const rawHtml = `<h1>${title}</h1>${content}`;
        const styled = transformToWechatHtml(rawHtml, activeTheme);
        setPreviewHtml(styled);
    }, [content, title, activeTheme]);

    // --- AGENT LOGIC ---

    const handleSendMessage = async (text: string) => {
        // Add User Message
        const userMsg: CMSMessage = { id: uuidv4(), role: 'user', content: text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setIsAgentTyping(true);

        try {
            // Call Gemini Agent with FULL context (Selection, Content, Topic)
            const response = await cmsAgentChat(
                [...messages, userMsg], 
                text, 
                { 
                    topic: topic || null, 
                    profile: userProfile, 
                    currentSelection: currentSelection,
                    articleContent: content
                }
            );

            // Execute Tool Action (The "Hands" of the Agent)
            await executeAgentAction(response.action);

            // Add Assistant Message
            const aiMsg: CMSMessage = { 
                id: uuidv4(), 
                role: 'assistant', 
                content: response.reply, 
                timestamp: Date.now(),
                // If action was ask_user_choice, populate uiOptions
                uiOptions: response.action.type === 'ask_user_choice' ? response.action.args.options : undefined
            };
            setMessages(prev => [...prev, aiMsg]);

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: '系统繁忙，请重试。', timestamp: Date.now() }]);
        } finally {
            setIsAgentTyping(false);
        }
    };

    const handleOptionSelect = (value: string, label: string) => {
        // 1. Mark previous options as executed (removes buttons visually or greys them out)
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.role === 'assistant' && last.uiOptions) {
                return [...prev.slice(0, -1), { ...last, isActionExecuted: true }];
            }
            return prev;
        });

        // 2. Feed the choice back to the Agent as a user message
        handleSendMessage(`我选择：${label}`);
    };

    const executeAgentAction = async (action: { type: string, args: any }) => {
        if (!editorRef.current) return;
        const editor = editorRef.current;

        switch (action.type) {
            case 'write_to_editor':
                // Append content. Using 'insertContent' at the end or current cursor.
                // We add a newline first to ensure block separation if appending.
                const contentToAdd = action.args.content;
                editor.chain().focus().insertContent(contentToAdd).run();
                break;

            case 'rewrite_selection':
                // Smart Replace: If selection exists, replace it. If not, insert.
                if (editor.state.selection.empty) {
                     editor.chain().focus().insertContent(action.args.content).run();
                } else {
                     editor.chain().focus().deleteSelection().insertContent(action.args.content).run();
                }
                learnFromCorrection("Original Text", action.args.content);
                break;

            case 'apply_theme':
                if (action.args.themeId && THEMES[action.args.themeId]) {
                    setActiveTheme(action.args.themeId);
                }
                break;

            case 'insert_image':
                // Insert generic image placeholder or AI image if URL provided
                const imgUrl = action.args.url || "https://placehold.co/600x400?text=AI+Image";
                editor.chain().focus().setImage({ src: imgUrl, alt: "AI Image" }).run();
                break;
                
            default:
                break;
        }
    };

    // --- UI HANDLERS ---
    const handleCopy = () => {
        const previewNode = document.getElementById('wechat-preview-content');
        if (previewNode) {
            const range = document.createRange();
            range.selectNode(previewNode);
            window.getSelection()?.removeAllRanges();
            window.getSelection()?.addRange(range);
            document.execCommand('copy');
            alert('已复制！请直接在微信公众号后台按 Ctrl+V 粘贴。');
        }
    };

    const handleAssetInsert = (url: string, alt: string) => {
        if(editorRef.current) {
            editorRef.current.chain().focus().setImage({ src: url, alt }).run();
        }
        setShowAssetLib(false);
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1a1a] relative">
            {/* Top Bar */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#1a1a1a] shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                        <i className="fa-brands fa-weixin"></i>
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-200 text-sm">Smart CMS</h2>
                        <span className="text-[10px] text-gray-500">{userProfile.name} Mode</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowStyleSettings(!showStyleSettings)} className="text-xs text-gray-400 hover:text-white mr-2">
                        <i className="fa-solid fa-user-gear mr-1"></i> 风格
                    </button>
                    <button onClick={() => setShowAssetLib(!showAssetLib)} className="text-xs text-gray-400 hover:text-white mr-2">
                        <i className="fa-solid fa-images mr-1"></i> 素材库
                    </button>
                    <button onClick={onGenerateScript} className="text-xs text-gray-400 hover:text-white mr-4" title="转为视频脚本"><i className="fa-solid fa-film mr-1"></i> 转脚本</button>
                    <button onClick={handleCopy} className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg">
                        <i className="fa-regular fa-copy"></i> 复制到微信
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                
                {/* 1. LEFT: INTELLIGENT CHAT AGENT */}
                <CMSChatPanel 
                    messages={messages} 
                    onSendMessage={handleSendMessage} 
                    onOptionSelect={handleOptionSelect}
                    isTyping={isAgentTyping}
                />

                {/* 2. MIDDLE: EDITOR */}
                <div className="flex-1 flex flex-col bg-[#1a1a1a] relative border-l border-r border-gray-800">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                         <div className="max-w-3xl mx-auto py-12 px-8 min-h-full">
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent text-4xl font-bold text-gray-100 mb-8 border-none focus:outline-none"
                                placeholder="输入标题..."
                            />
                            <TiptapEditor 
                                content={content} 
                                onChange={onChange} 
                                onEditorReady={(ed) => editorRef.current = ed}
                                onSelectionChange={setCurrentSelection}
                            />
                         </div>
                    </div>
                </div>

                {/* 3. RIGHT: PREVIEW */}
                <div className="w-[360px] bg-[#141414] flex flex-col shrink-0">
                    <div className="p-3 bg-[#141414] border-b border-gray-800 flex justify-between">
                         <span className="text-xs font-bold text-gray-500 uppercase">WeChat Preview</span>
                         <div className="flex gap-1">
                            {Object.values(THEMES).map(t => (
                                <button key={t.id} onClick={() => setActiveTheme(t.id)} className={`w-3 h-3 rounded-full ${activeTheme === t.id ? 'ring-1 ring-white' : 'opacity-50'}`} style={{ background: t.colors.primary }} />
                            ))}
                         </div>
                    </div>
                    <div className="flex-1 bg-gray-900 p-4 flex justify-center overflow-hidden">
                        <div className="w-[320px] bg-white h-full overflow-y-auto custom-scrollbar shadow-xl">
                            <div id="wechat-preview-content" dangerouslySetInnerHTML={{ __html: previewHtml }} className="p-4" />
                            <div className="p-4 text-center text-xs text-gray-400">{userProfile.preferredEnding}</div>
                        </div>
                    </div>
                </div>

                {/* Drawers */}
                {showAssetLib && <AssetLibrary onInsert={handleAssetInsert} onClose={() => setShowAssetLib(false)} />}
                
                {/* Style Settings Drawer */}
                {showStyleSettings && (
                    <div className="absolute top-0 left-0 w-64 h-full bg-[#1e1e1e] shadow-2xl z-40 p-4 animate-in slide-in-from-left">
                        <h3 className="text-xs font-bold text-white mb-4">风格配置</h3>
                        <div className="mb-4">
                            <label className="text-[10px] text-gray-500 block mb-1">语气 (Tone)</label>
                            <select 
                                value={userProfile.tone}
                                onChange={(e) => { const p = { ...userProfile, tone: e.target.value }; setUserProfile(p); saveProfile(p); }}
                                className="w-full bg-[#333] text-white text-xs p-2 rounded"
                            >
                                <option value="Professional">专业严谨</option>
                                <option value="Witty">幽默风趣 (朱迪警官)</option>
                                <option value="Emotional">情感共鸣</option>
                            </select>
                        </div>
                        <button onClick={() => setShowStyleSettings(false)} className="bg-blue-600 text-white text-xs w-full py-2 rounded">关闭</button>
                    </div>
                )}
            </div>
        </div>
    );
};
export default ArticleEditor;
