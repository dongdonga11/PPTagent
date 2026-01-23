
import React, { useState, useEffect } from 'react';
import { extractGoldenQuotes } from '../services/geminiService';
import AssetLibrary from './AssetLibrary';
import { GlobalStyle } from '../types';

interface PosterEditorProps {
    sourceMaterial: string;
    projectTitle: string;
    globalStyle: GlobalStyle;
}

// Simple Poster Templates
const TEMPLATES = [
    { id: 'minimal', name: '极简黑白', bg: '#1a1a1a', text: '#ffffff', font: 'sans-serif', overlay: 0.2 },
    { id: 'paper', name: '纸张质感', bg: '#f5f5f0', text: '#333333', font: 'serif', overlay: 0 },
    { id: 'vibrant', name: '活力渐变', bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#ffffff', font: 'sans-serif', overlay: 0 },
    { id: 'warm', name: '温暖日落', bg: 'linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)', text: '#fff', font: 'serif', overlay: 0.1 }
];

const PosterEditor: React.FC<PosterEditorProps> = ({ sourceMaterial, projectTitle, globalStyle }) => {
    // --- STATE ---
    const [quotes, setQuotes] = useState<string[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);
    
    // Canvas State
    const [selectedQuote, setSelectedQuote] = useState("点击左侧提取金句，或直接编辑此文本。");
    const [bgImage, setBgImage] = useState<string | null>(null);
    const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0]);
    const [showAssetLib, setShowAssetLib] = useState(false);
    const [customTitle, setCustomTitle] = useState(projectTitle);

    // --- ACTIONS ---
    const handleExtract = async () => {
        setIsExtracting(true);
        try {
            const results = await extractGoldenQuotes(sourceMaterial);
            setQuotes(results);
            if(results.length > 0) setSelectedQuote(results[0]);
        } catch (e) {
            console.error(e);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleBgInsert = (url: string) => {
        setBgImage(url);
        setShowAssetLib(false);
    };

    // --- RENDER ---
    return (
        <div className="flex h-full bg-[#0F0F12]">
            
            {/* 1. LEFT: INTELLIGENCE PANEL */}
            <div className="w-80 bg-[#141414] border-r border-gray-800 flex flex-col shrink-0">
                <div className="h-14 flex items-center px-4 border-b border-gray-800 bg-[#1a1a1a]">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                        <i className="fa-solid fa-brain text-pink-500"></i> 内容智能 (Content AI)
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {/* Extract Button */}
                    <div className="mb-6 text-center">
                        <button 
                            onClick={handleExtract}
                            disabled={isExtracting}
                            className={`w-full py-3 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all
                                ${isExtracting 
                                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-lg hover:shadow-pink-500/20 hover:scale-[1.02]'}
                            `}
                        >
                            {isExtracting ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                            {isExtracting ? '正在阅读文章...' : 'AI 提取金句 (Extract)'}
                        </button>
                        <p className="text-[10px] text-gray-500 mt-2">基于 Source Material 自动提炼适合小红书的短句</p>
                    </div>

                    {/* Quotes List */}
                    <div className="space-y-3">
                        {quotes.map((quote, idx) => (
                            <div 
                                key={idx}
                                onClick={() => setSelectedQuote(quote)}
                                className={`p-3 rounded border cursor-pointer transition-all text-sm leading-relaxed
                                    ${selectedQuote === quote 
                                        ? 'bg-[#1e1e1e] border-pink-500 text-white shadow-md' 
                                        : 'bg-[#1a1a1a] border-gray-800 text-gray-400 hover:bg-[#222] hover:text-gray-300'}
                                `}
                            >
                                "{quote}"
                            </div>
                        ))}
                        {quotes.length === 0 && !isExtracting && (
                            <div className="text-center text-gray-600 py-10 border border-dashed border-gray-800 rounded-lg">
                                <i className="fa-regular fa-lightbulb text-2xl mb-2 opacity-20"></i>
                                <p className="text-xs">暂无金句，请先提取</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. CENTER: CANVAS PREVIEW */}
            <div className="flex-1 bg-[#0F0F12] flex flex-col relative min-w-0">
                <div className="h-14 flex items-center justify-between px-6 border-b border-gray-800 bg-[#0F0F12]">
                    <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">
                         Canvas Preview (3:4 Ratio)
                    </span>
                    <button 
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs font-bold transition-colors"
                        onClick={() => alert('下载功能需 html2canvas 支持，目前仅作预览展示')}
                    >
                        <i className="fa-solid fa-download mr-1"></i> 导出图片
                    </button>
                </div>

                <div className="flex-1 flex items-center justify-center p-8 bg-black/50 overflow-hidden relative">
                    {/* THE POSTER CANVAS */}
                    <div 
                        className="relative shadow-2xl overflow-hidden transition-all duration-300 group"
                        style={{
                            width: '360px', // Fixed scale for preview
                            height: '480px', // 3:4 aspect ratio
                            background: activeTemplate.bg,
                            fontFamily: activeTemplate.font
                        }}
                    >
                        {/* Background Image Layer */}
                        {bgImage && (
                            <div className="absolute inset-0 z-0">
                                <img src={bgImage} alt="bg" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black" style={{ opacity: activeTemplate.overlay }}></div>
                            </div>
                        )}

                        {/* Content Layer */}
                        <div className="relative z-10 w-full h-full p-8 flex flex-col justify-between">
                            {/* Top Brand/Title */}
                            <div className="flex items-center justify-between opacity-80" style={{ color: activeTemplate.text }}>
                                <div className="text-[10px] font-bold tracking-widest uppercase border px-1.5 py-0.5" style={{ borderColor: activeTemplate.text }}>
                                    SpaceCoding
                                </div>
                                <div className="text-[10px] font-mono">
                                    {new Date().toLocaleDateString()}
                                </div>
                            </div>

                            {/* Main Quote */}
                            <div className="flex-1 flex items-center justify-center">
                                <div 
                                    contentEditable
                                    suppressContentEditableWarning
                                    className="text-2xl font-bold leading-tight text-center outline-none"
                                    style={{ color: activeTemplate.text, textShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                                >
                                    {selectedQuote}
                                </div>
                            </div>

                            {/* Footer / Call to Action */}
                            <div className="border-t pt-4 flex justify-between items-end" style={{ borderColor: `${activeTemplate.text}40` }}>
                                <div style={{ color: activeTemplate.text }}>
                                    <h3 className="text-xs font-bold mb-1">{customTitle}</h3>
                                    <p className="text-[9px] opacity-70 max-w-[150px]">
                                        关注我们，每天获取最新科技与商业洞察。
                                    </p>
                                </div>
                                <div className="w-12 h-12 bg-white p-1">
                                    <div className="w-full h-full border border-black bg-black/10 flex items-center justify-center text-[8px] text-black font-mono">
                                        QR Code
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hover Edit Hint */}
                        <div className="absolute inset-0 bg-blue-500/10 border-2 border-blue-500 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity flex items-center justify-center">
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded shadow-lg">可直接编辑文字</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. RIGHT: DESIGN PANEL */}
            <div className="w-80 bg-[#141414] border-l border-gray-800 flex flex-col shrink-0">
                <div className="h-14 flex items-center px-4 border-b border-gray-800 bg-[#1a1a1a]">
                    <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                        <i className="fa-solid fa-palette text-pink-500"></i> 视觉设计 (Design)
                    </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                    
                    {/* Templates */}
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-3 block">模板风格 (Templates)</label>
                        <div className="grid grid-cols-2 gap-3">
                            {TEMPLATES.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setActiveTemplate(t)}
                                    className={`h-12 rounded border text-xs font-bold transition-all relative overflow-hidden
                                        ${activeTemplate.id === t.id ? 'border-pink-500 ring-1 ring-pink-500' : 'border-gray-700 hover:border-gray-500'}
                                    `}
                                    style={{ background: t.bg, color: t.text }}
                                >
                                    <span className="relative z-10">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Background Image */}
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-3 block">背景图片 (Background)</label>
                        {bgImage ? (
                            <div className="relative group rounded-lg overflow-hidden border border-gray-700 aspect-video">
                                <img src={bgImage} alt="bg" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => setShowAssetLib(true)} className="text-white hover:text-pink-400"><i className="fa-solid fa-arrows-rotate"></i></button>
                                    <button onClick={() => setBgImage(null)} className="text-white hover:text-red-400"><i className="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setShowAssetLib(true)}
                                className="w-full h-24 border border-dashed border-gray-700 rounded-lg flex flex-col items-center justify-center text-gray-500 hover:text-pink-400 hover:border-pink-500/50 hover:bg-pink-900/10 transition-all gap-2"
                            >
                                <i className="fa-regular fa-image text-xl"></i>
                                <span className="text-xs">选择或生成背景图</span>
                            </button>
                        )}
                    </div>

                    {/* Meta Info */}
                    <div>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-3 block">海报信息</label>
                        <div className="space-y-3">
                            <div>
                                <span className="text-[10px] text-gray-400 block mb-1">标题文字</span>
                                <input 
                                    type="text" 
                                    value={customTitle} 
                                    onChange={(e) => setCustomTitle(e.target.value)}
                                    className="w-full bg-[#111] border border-gray-700 rounded p-2 text-xs text-gray-300 focus:outline-none focus:border-pink-500"
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Asset Drawer */}
            {showAssetLib && (
                <AssetLibrary onInsert={handleBgInsert} onClose={() => setShowAssetLib(false)} />
            )}
        </div>
    );
};

export default PosterEditor;
