
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import TiptapEditor from './TiptapEditor';
import { transformToWechatHtml, THEMES } from '../utils/wechatStyleEngine';
import AssetLibrary from './AssetLibrary';
import CMSChatPanel from './CMSChatPanel';
import { getProfile, saveProfile, learnFromCorrection } from '../services/styleManager';
import { cmsAgentChat, generateAiImage } from '../services/geminiService';
import { pushToGitHub } from '../services/githubService'; 
import { UserStyleProfile, CMSMessage, ResearchTopic } from '../types';
import { Editor } from '@tiptap/react';

interface ArticleEditorProps {
    content: string;
    onChange: (text: string) => void;
    onGenerateScript: () => void;
    isProcessing: boolean;
    topic?: ResearchTopic; 
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ content, onChange, onGenerateScript, isProcessing, topic }) => {
    // --- STATE ---
    const [title, setTitle] = useState(topic?.title || "未命名创作");
    const [activeTheme, setActiveTheme] = useState('kaoxing'); 
    const [previewHtml, setPreviewHtml] = useState('');
    
    // UI Toggles
    const [showAssetLib, setShowAssetLib] = useState(false);
    const [isSyncingGithub, setIsSyncingGithub] = useState(false);
    
    // Agent State
    const [messages, setMessages] = useState<CMSMessage[]>([]);
    const [isAgentTyping, setIsAgentTyping] = useState(false);
    const [currentSelection, setCurrentSelection] = useState('');
    
    // Editor Ref
    const editorRef = useRef<Editor | null>(null);

    // Profile (Read only here, modified via global settings)
    const userProfile = getProfile();

    // --- EFFECTS ---

    // 1. Proactive Agent Initialization
    useEffect(() => {
        if (topic && messages.length === 0) {
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
    }, [topic]);

    // 2. Selection Listener -> UI Feedback
    useEffect(() => {
        if (currentSelection.length > 5) {
             console.log("Agent Context Update: Selection Active", currentSelection.substring(0, 10));
        }
    }, [currentSelection]);

    // 3. Preview Update
    useEffect(() => {
        const rawHtml = `<h1>${title}</h1>${content}`;
        const styled = transformToWechatHtml(rawHtml, activeTheme);
        setPreviewHtml(styled);
    }, [content, title, activeTheme]);

    // --- ACTIONS ---

    const handleGitHubSync = async () => {
        // Reload profile to get latest settings
        const currentProfile = getProfile();
        
        if (!currentProfile.githubConfig?.token) {
            alert("请先点击左下角齿轮，在【全局设置】中配置 GitHub Token");
            return;
        }
        setIsSyncingGithub(true);
        try {
            const fileName = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.html`;
            const result = await pushToGitHub(
                currentProfile.githubConfig,
                fileName,
                previewHtml, 
                `Update article: ${title}`
            );

            if (result.success) {
                alert(`✅ 同步成功！\nURL: ${result.url}`);
            } else {
                alert(`❌ 同步失败: ${result.message}`);
            }
        } catch (e) {
            alert("Sync Error");
        } finally {
            setIsSyncingGithub(false);
        }
    };

    // --- AGENT LOGIC ---

    const handleSendMessage = async (text: string) => {
        const userMsg: CMSMessage = { id: uuidv4(), role: 'user', content: text, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setIsAgentTyping(true);

        try {
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

            // Execute Tool Action
            await executeAgentAction(response.action);

            const aiMsg: CMSMessage = { 
                id: uuidv4(), 
                role: 'assistant', 
                content: response.reply, 
                timestamp: Date.now(),
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
        setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.role === 'assistant' && last.uiOptions) {
                return [...prev.slice(0, -1), { ...last, isActionExecuted: true }];
            }
            return prev;
        });
        handleSendMessage(`我选择：${label}`);
    };

    const executeAgentAction = async (action: { type: string, args: any }) => {
        if (!editorRef.current) return;
        const editor = editorRef.current;

        switch (action.type) {
            case 'write_to_editor':
                editor.chain().focus().insertContent(action.args.content).run();
                break;

            case 'rewrite_selection':
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
                if (action.args.url) {
                     editor.chain().focus().setImage({ src: action.args.url, alt: 'AI Image' }).run();
                } else if (action.args.prompt) {
                     setMessages(prev => [...prev, { id: uuidv4(), role: 'system', content: `正在生成配图: ${action.args.prompt}...`, timestamp: Date.now() }]);
                     try {
                         const imgData = await generateAiImage(action.args.prompt);
                         if (imgData) {
                             editor.chain().focus().setImage({ src: imgData, alt: action.args.prompt }).run();
                         } else {
                             editor.chain().focus().insertContent(`<blockquote>[图片生成失败] Prompt: ${action.args.prompt}</blockquote>`).run();
                         }
                     } catch (e) {
                         console.error(e);
                     }
                }
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

    const handleAssetInsert = (url: string, alt: string, type?: 'image' | 'video') => {
        if(!editorRef.current) return;
        
        if (type === 'video') {
            editorRef.current.chain().focus().insertContent(`<video src="${url}" controls class="w-full rounded-lg my-4"></video><p></p>`).run();
        } else {
            editorRef.current.chain().focus().setImage({ src: url, alt }).run();
        }
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
                    <button onClick={() => setShowAssetLib(!showAssetLib)} className={`text-xs mr-2 transition-colors ${showAssetLib ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                        <i className="fa-solid fa-images mr-1"></i> 素材库
                    </button>
                    
                    {/* GITHUB SYNC */}
                    <button 
                        onClick={handleGitHubSync}
                        disabled={isSyncingGithub}
                        className={`text-xs mr-2 flex items-center gap-2 px-3 py-1.5 rounded transition-all border border-gray-700
                            ${isSyncingGithub 
                                ? 'bg-gray-800 text-gray-400 cursor-wait' 
                                : 'hover:bg-gray-800 hover:text-white text-gray-300'
                            }`}
                        title={userProfile.githubConfig?.token ? "Sync to GitHub" : "请先在全局设置配置 GitHub"}
                    >
                         {isSyncingGithub ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-brands fa-github"></i>}
                    </button>

                    {/* GENERATE SCRIPT BUTTON */}
                    <button 
                        onClick={onGenerateScript} 
                        disabled={isProcessing}
                        className={`text-xs mr-4 flex items-center gap-2 px-3 py-1.5 rounded transition-all
                            ${isProcessing 
                                ? 'bg-indigo-900/30 text-indigo-300 ring-1 ring-indigo-500/50 cursor-wait' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <i className="fa-solid fa-circle-notch fa-spin text-indigo-400"></i>
                                <span>正在拆解...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-film"></i> 
                                <span>转为脚本 (A2S)</span>
                            </>
                        )}
                    </button>

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
            </div>
        </div>
    );
};
export default ArticleEditor;
