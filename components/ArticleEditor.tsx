import React from 'react';

interface ArticleEditorProps {
    content: string;
    onChange: (text: string) => void;
    onGenerateScript: () => void;
    isProcessing: boolean;
}

const ArticleEditor: React.FC<ArticleEditorProps> = ({ content, onChange, onGenerateScript, isProcessing }) => {
    return (
        <div className="flex flex-col h-full bg-gray-900">
            {/* Toolbar */}
            <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-950">
                <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-purple-900/50 text-purple-400 flex items-center justify-center text-xs border border-purple-800">1</span>
                    <h2 className="font-bold text-gray-200">文案中心 (Story Center)</h2>
                </div>
                <button 
                    onClick={onGenerateScript}
                    disabled={isProcessing || !content.trim()}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-bold transition-all
                        ${isProcessing || !content.trim() 
                            ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
                        }
                    `}
                >
                    {isProcessing ? (
                        <><i className="fa-solid fa-circle-notch fa-spin"></i> 处理中...</>
                    ) : (
                        <><i className="fa-solid fa-wand-magic-sparkles"></i> AI 拆解为分镜脚本</>
                    )}
                </button>
            </div>

            {/* Main Editor Area */}
            <div className="flex-1 p-8 max-w-4xl mx-auto w-full flex flex-col">
                <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 flex-1 flex flex-col shadow-inner">
                    <input 
                        type="text" 
                        placeholder="在此输入文章标题..." 
                        className="bg-transparent text-3xl font-bold text-white mb-6 border-b border-transparent focus:border-gray-700 focus:outline-none placeholder-gray-600 pb-2"
                    />
                    <textarea 
                        className="flex-1 bg-transparent text-gray-300 text-lg leading-relaxed focus:outline-none resize-none placeholder-gray-600"
                        placeholder="在此撰写或粘贴您的核心文案/文章内容。完成后点击右上角生成分镜..."
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                    />
                </div>
                <p className="text-center text-gray-600 text-xs mt-4">
                    提示: 您可以在此写一篇完整的文章，AI 会自动提取关键点生成 PPT 结构。
                </p>
            </div>
        </div>
    );
};

export default ArticleEditor;