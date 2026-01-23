import React, { useState, useEffect } from 'react';
import TiptapEditor from './TiptapEditor';
import { transformToWechatHtml, extractOutline, THEMES } from '../utils/wechatStyleEngine';
import AssetLibrary from './AssetLibrary';
import { getProfile, saveProfile } from '../services/styleManager';
import { UserStyleProfile } from '../types';
import { generateArticleSection } from '../services/geminiService';

interface ArticleEditorProps {
    content: string;
    onChange: (text: string) => void;
    onGenerateScript: () => void;
    isProcessing: boolean;
    topicTitle?: string;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ content, onChange, onGenerateScript, isProcessing, topicTitle }) => {
    const [title, setTitle] = useState(topicTitle || "未命名创作");
    const [activeTheme, setActiveTheme] = useState('kaoxing'); 
    const [previewHtml, setPreviewHtml] = useState('');
    const [outline, setOutline] = useState<{id: string, level: number, text: string}[]>([]);
    
    // CMS Features
    const [showAssetLib, setShowAssetLib] = useState(false);
    const [userProfile, setUserProfile] = useState<UserStyleProfile>(getProfile());
    const [showStyleSettings, setShowStyleSettings] = useState(false);
    const [showInteractiveGuide, setShowInteractiveGuide] = useState(false);

    useEffect(() => {
        const rawHtml = `<h1>${title}</h1>${content}`;
        const styled = transformToWechatHtml(rawHtml, activeTheme);
        setPreviewHtml(styled);
        setOutline(extractOutline(content));
    }, [content, title, activeTheme]);

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
        const imgHtml = `<img src="${url}" alt="${alt}" />`;
        onChange(content + `<p>${imgHtml}</p>`);
        setShowAssetLib(false);
    };
    
    const handleGuideSelection = async (option: string) => {
        setShowInteractiveGuide(false);
        // Call AI with the selected option context
        const newText = await generateArticleSection(content, `Continue writing using the '${option}' approach.`, userProfile);
        onChange(content + newText);
    };

    // Triggered when user asks for AI help but we want to confirm style first
    const triggerAiGuide = () => {
        setShowInteractiveGuide(true);
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
                    <button onClick={triggerAiGuide} className="text-xs text-blue-400 hover:text-white mr-2 border border-blue-900 rounded px-2 py-1">
                        <i className="fa-solid fa-wand-magic-sparkles mr-1"></i> AI 续写
                    </button>
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
                {/* LEFT: Outline / Style */}
                <div className="w-64 bg-[#141414] border-r border-gray-800 flex flex-col hidden md:flex">
                     {showStyleSettings ? (
                        <div className="p-4 flex flex-col h-full overflow-y-auto">
                            <h3 className="text-xs font-bold text-white mb-4">风格记忆体配置</h3>
                            <div className="mb-4">
                                <label className="text-[10px] text-gray-500 block mb-1">语气 (Tone)</label>
                                <select 
                                    value={userProfile.tone}
                                    onChange={(e) => { const p = { ...userProfile, tone: e.target.value }; setUserProfile(p); saveProfile(p); }}
                                    className="w-full bg-[#222] text-white text-xs p-2 rounded border border-gray-700"
                                >
                                    <option value="Professional">专业严谨</option>
                                    <option value="Witty">幽默风趣</option>
                                    <option value="Emotional">情感共鸣</option>
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="text-[10px] text-gray-500 block mb-1">固定结尾</label>
                                <textarea 
                                    value={userProfile.preferredEnding}
                                    onChange={(e) => { const p = { ...userProfile, preferredEnding: e.target.value }; setUserProfile(p); saveProfile(p); }}
                                    className="w-full bg-[#222] text-white text-xs p-2 rounded border border-gray-700 h-20"
                                />
                            </div>
                             <button onClick={() => setShowStyleSettings(false)} className="mt-auto w-full bg-blue-600 text-white text-xs py-2 rounded">保存</button>
                        </div>
                    ) : (
                        <>
                             <div className="p-4 border-b border-gray-800"><span className="text-xs font-bold text-gray-500 uppercase">大纲</span></div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {outline.map((item, idx) => (<div key={idx} className={`text-sm text-gray-400 pl-${(item.level-1)*2} hover:text-blue-400 cursor-pointer`}>{item.text}</div>))}
                            </div>
                        </>
                    )}
                </div>

                {/* MIDDLE: Editor */}
                <div className="flex-1 flex flex-col bg-[#1a1a1a] relative">
                    {/* Interactive Guide Overlay */}
                    {showInteractiveGuide && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-[#222] border border-gray-700 p-4 rounded-xl shadow-2xl w-96 animate-in fade-in zoom-in">
                            <h3 className="text-sm font-bold text-white mb-3">🤔 AI: 这一段怎么写？</h3>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => handleGuideSelection('Storytelling')} className="bg-blue-900/30 text-blue-300 p-2 rounded text-xs hover:bg-blue-900/50">📖 讲故事</button>
                                <button onClick={() => handleGuideSelection('Data Driven')} className="bg-green-900/30 text-green-300 p-2 rounded text-xs hover:bg-green-900/50">📊 摆数据</button>
                                <button onClick={() => handleGuideSelection('Emotional')} className="bg-red-900/30 text-red-300 p-2 rounded text-xs hover:bg-red-900/50">🔥 煽情绪</button>
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                         <div className="max-w-3xl mx-auto py-12 px-8 min-h-full">
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent text-4xl font-bold text-gray-100 mb-8 border-none focus:outline-none"
                            />
                            <TiptapEditor content={content} onChange={onChange} />
                         </div>
                    </div>
                </div>

                {/* RIGHT: Preview */}
                <div className="w-[360px] bg-[#141414] border-l border-gray-800 flex flex-col shrink-0">
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

                {showAssetLib && <AssetLibrary onInsert={handleAssetInsert} onClose={() => setShowAssetLib(false)} />}
            </div>
        </div>
    );
};
export default ArticleEditor;
