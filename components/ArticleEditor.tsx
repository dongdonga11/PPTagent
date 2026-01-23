
import React, { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import TiptapEditor from './TiptapEditor';
import { transformToWechatHtml, THEMES } from '../utils/wechatStyleEngine';
import AssetLibrary from './AssetLibrary';
import CMSChatPanel from './CMSChatPanel';
import { getProfile, saveProfile, learnFromCorrection } from '../services/styleManager';
import { cmsAgentChat, generateAiImage } from '../services/geminiService';
import { UserStyleProfile, CMSMessage, Article } from '../types';
import { Editor } from '@tiptap/react';

interface ArticleEditorProps {
    article?: Article; // Optional existing article
    onSave: (title: string, content: string, plainText: string) => void;
    onBack: () => void;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ article, onSave, onBack }) => {
    // --- STATE ---
    const [title, setTitle] = useState(article?.title || "未命名创作");
    const [content, setContent] = useState(article?.content || "<p>开始您的创作...</p>");
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

    // Preview Update
    useEffect(() => {
        const rawHtml = `<h1>${title}</h1>${content}`;
        const styled = transformToWechatHtml(rawHtml, activeTheme);
        setPreviewHtml(styled);
    }, [content, title, activeTheme]);

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
                    topic: null, 
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

    const handleSaveAction = () => {
        const plainText = editorRef.current?.getText() || "";
        onSave(title, content, plainText);
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1a1a] relative">
            {/* Top Bar */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#1a1a1a] shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="text-gray-500 hover:text-white transition-colors">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div className="h-6 w-[1px] bg-gray-700"></div>
                    <div>
                        <h2 className="font-bold text-gray-200 text-sm">写作工坊 (Writer Studio)</h2>
                        <span className="text-[10px] text-gray-500">{userProfile.name} Mode</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowStyleSettings(!showStyleSettings)} className="text-xs text-gray-400 hover:text-white mr-2">
                        <i className="fa-solid fa-user-gear mr-1"></i> 风格
                    </button>
                    <button onClick={() => setShowAssetLib(!showAssetLib)} className={`text-xs mr-2 transition-colors ${showAssetLib ? 'text-blue-400 font-bold' : 'text-gray-400 hover:text-white'}`}>
                        <i className="fa-solid fa-images mr-1"></i> 素材库
                    </button>

                    <button 
                        onClick={handleSaveAction}
                        className="flex items-center gap-2 px-6 py-1.5 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all"
                    >
                        <i className="fa-solid fa-floppy-disk"></i> 保存文章
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
                                onChange={setContent} 
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
                             <button onClick={handleCopy} className="text-[10px] bg-green-600 hover:bg-green-500 text-white px-2 py-0.5 rounded">复制</button>
                         </div>
                    </div>
                    {/* Theme Selector */}
                    <div className="p-2 border-b border-gray-800 flex gap-2 justify-center">
                        {Object.values(THEMES).map(t => (
                             <button key={t.id} onClick={() => setActiveTheme(t.id)} className={`w-4 h-4 rounded-full ${activeTheme === t.id ? 'ring-2 ring-white scale-110' : 'opacity-50'}`} style={{ background: t.colors.primary }} title={t.name} />
                        ))}
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
                    <div className="absolute top-0 right-0 w-64 h-full bg-[#1e1e1e] shadow-2xl z-40 p-4 animate-in slide-in-from-right">
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
