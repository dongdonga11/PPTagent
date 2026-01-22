
import React, { useState, useEffect, useMemo } from 'react';
import TiptapEditor from './TiptapEditor';
import { transformToWechatHtml, extractOutline, THEMES } from '../utils/wechatStyleEngine';

interface ArticleEditorProps {
    content: string;
    onChange: (text: string) => void;
    onGenerateScript: () => void;
    isProcessing: boolean;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ content, onChange, onGenerateScript, isProcessing }) => {
    const [title, setTitle] = useState("未命名创作");
    const [activeTheme, setActiveTheme] = useState('kaoxing'); // Default to Kaoxing
    const [previewHtml, setPreviewHtml] = useState('');
    const [outline, setOutline] = useState<{id: string, level: number, text: string}[]>([]);
    
    // Auto-update preview and outline when content/title/theme changes
    useEffect(() => {
        // 1. Generate Wechat Styled HTML
        const rawHtml = `<h1>${title}</h1>${content}`;
        const styled = transformToWechatHtml(rawHtml, activeTheme);
        setPreviewHtml(styled);

        // 2. Extract Outline
        setOutline(extractOutline(content));
    }, [content, title, activeTheme]);

    const handleCopy = () => {
        // We need to copy the HTML with inline styles to clipboard
        // The most compatible way for WeChat is actually copying the rendered nodes
        const previewNode = document.getElementById('wechat-preview-content');
        if (previewNode) {
            const range = document.createRange();
            range.selectNode(previewNode);
            const selection = window.getSelection();
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
                document.execCommand('copy');
                selection.removeAllRanges();
                alert('已复制！请直接在微信公众号后台按 Ctrl+V 粘贴。');
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-[#1a1a1a]">
            {/* Top Bar */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#1a1a1a] shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                        <i className="fa-brands fa-weixin"></i>
                    </div>
                    <h2 className="font-bold text-gray-200">Smart CMS <span className="text-xs font-normal text-gray-500 ml-2">微信公众号创作台</span></h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onGenerateScript}
                        disabled={isProcessing || !content.trim()}
                        className="text-xs text-gray-400 hover:text-white transition-colors mr-4"
                        title="转为视频脚本"
                    >
                         <i className="fa-solid fa-film mr-1"></i> 转脚本
                    </button>

                    <button 
                        onClick={handleCopy}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg transition-transform hover:scale-105"
                    >
                        <i className="fa-regular fa-copy"></i> 复制到微信
                    </button>
                </div>
            </div>

            {/* 3-Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                
                {/* LEFT: Inspiration & Outline */}
                <div className="w-64 bg-[#141414] border-r border-gray-800 flex flex-col hidden md:flex">
                    <div className="p-4 border-b border-gray-800">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">大纲 (Outline)</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {outline.length === 0 ? (
                            <p className="text-xs text-gray-600 italic">输入 H1/H2 标题自动生成...</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {outline.map((item, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`text-sm text-gray-400 truncate pl-${(item.level - 1) * 3} border-l-2 border-transparent hover:border-blue-500 hover:text-blue-400 cursor-pointer pl-2 transition-colors`}
                                    >
                                        {item.text}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    {/* AI Inspiration Box */}
                    <div className="p-4 bg-gray-900 border-t border-gray-800">
                        <div className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-2">
                            <i className="fa-solid fa-lightbulb"></i> AI 灵感
                        </div>
                        <div className="text-xs text-gray-500 leading-relaxed">
                            试试输入 "/" 唤起 AI 续写，或选中文字让 AI 帮你改写成“朱迪警官”风格。
                        </div>
                    </div>
                </div>

                {/* MIDDLE: The Canvas (Editor) */}
                <div className="flex-1 flex flex-col bg-[#1a1a1a] relative">
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="max-w-3xl mx-auto py-12 px-8 min-h-full bg-[#1a1a1a]">
                            <input 
                                type="text" 
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="输入标题..." 
                                className="w-full bg-transparent text-4xl font-bold text-gray-100 mb-8 border-none focus:outline-none placeholder-gray-700"
                            />
                            <TiptapEditor content={content} onChange={onChange} />
                        </div>
                    </div>
                </div>

                {/* RIGHT: Preview & Style */}
                <div className="w-[380px] bg-[#141414] border-l border-gray-800 flex flex-col shrink-0">
                    <div className="p-3 border-b border-gray-800 flex justify-between items-center bg-[#141414]">
                        <span className="text-xs font-bold text-gray-500 uppercase">微信预览 (Preview)</span>
                        
                        {/* Theme Select */}
                        <div className="flex gap-2">
                            {Object.values(THEMES).map(theme => (
                                <button
                                    key={theme.id}
                                    onClick={() => setActiveTheme(theme.id)}
                                    className={`w-4 h-4 rounded-full border border-gray-600 ${activeTheme === theme.id ? 'ring-2 ring-white scale-110' : 'opacity-50 hover:opacity-100'}`}
                                    style={{ backgroundColor: theme.colors.primary }}
                                    title={theme.name}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex-1 bg-gray-900 p-4 flex items-center justify-center overflow-hidden relative">
                         {/* Phone Frame Mockup */}
                         <div className="w-[320px] h-[600px] bg-white rounded-[40px] border-[8px] border-gray-800 shadow-2xl overflow-hidden relative flex flex-col">
                            {/* Notch */}
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-xl z-20"></div>
                            
                            {/* Status Bar Mock */}
                            <div className="h-8 bg-gray-100 w-full shrink-0 z-10 border-b border-gray-200"></div>

                            {/* Content Area */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white relative">
                                <div className="p-4">
                                     {/* Rendered WeChat HTML */}
                                     <div 
                                        id="wechat-preview-content"
                                        dangerouslySetInnerHTML={{ __html: previewHtml }} 
                                     />
                                     <div className="mt-8 text-center text-xs text-gray-300">
                                        —— END ——
                                     </div>
                                </div>
                            </div>

                             {/* Bottom Bar Mock */}
                            <div className="h-12 bg-gray-50 w-full shrink-0 border-t border-gray-200 flex items-center justify-around text-gray-400 text-xl z-10">
                                <i className="fa-solid fa-keyboard"></i>
                                <i className="fa-solid fa-bars"></i>
                            </div>
                         </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ArticleEditor;
