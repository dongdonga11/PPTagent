
import React, { useState, useEffect, useRef } from 'react';
import { Slide, SlideLayoutType } from '../types';
import { calculateDuration, getLayoutIcon } from '../utils/scriptUtils';
import { SlideRenderer } from './PresentationRunner';

interface ScriptStoryboardProps {
    slides: Slide[];
    activeSlideId: string | null;
    onSelect: (id: string) => void;
    onUpdateSlide: (id: string, updates: Partial<Slide>) => void;
    globalStyle: any;
    onGenerateVisual: (id: string) => void;
}

const ScriptStoryboard: React.FC<ScriptStoryboardProps> = ({ 
    slides, 
    activeSlideId, 
    onSelect, 
    onUpdateSlide,
    globalStyle,
    onGenerateVisual
}) => {
    
    const activeSlide = slides.find(s => s.id === activeSlideId);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active card
    useEffect(() => {
        if (activeSlideId && scrollRef.current) {
            const el = document.getElementById(`scene-card-${activeSlideId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [activeSlideId]);

    const handleNarrationChange = (id: string, newText: string) => {
        // 1. Update text
        // 2. Auto-recalculate duration
        const newDuration = calculateDuration(newText);
        onUpdateSlide(id, { narration: newText, duration: newDuration });
    };

    return (
        <div className="flex h-full bg-[#0F0F12]">
            {/* --- LEFT: STORY STREAM (Script) --- */}
            <div className="w-[400px] flex flex-col border-r border-gray-800 bg-[#141414]">
                <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800 bg-[#1a1a1a]">
                    <h2 className="text-sm font-bold text-gray-200">
                        <i className="fa-solid fa-layer-group text-blue-500 mr-2"></i>分镜流 (Story Stream)
                    </h2>
                    <span className="text-xs text-gray-500">{slides.length} Scenes</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar" ref={scrollRef}>
                    {slides.map((slide, index) => {
                        const isActive = activeSlideId === slide.id;
                        return (
                            <div 
                                key={slide.id}
                                id={`scene-card-${slide.id}`}
                                onClick={() => onSelect(slide.id)}
                                className={`
                                    relative rounded-xl border-2 transition-all cursor-pointer group
                                    ${isActive 
                                        ? 'bg-[#1e1e1e] border-blue-500 shadow-lg shadow-blue-900/20' 
                                        : 'bg-[#1a1a1a] border-transparent hover:border-gray-700 hover:bg-[#222]'}
                                `}
                            >
                                {/* Header: Index & Layout */}
                                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800/50">
                                    <div className="flex items-center gap-2">
                                        <span className={`
                                            flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold
                                            ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}
                                        `}>
                                            {index + 1}
                                        </span>
                                        <span className="text-xs font-medium text-gray-400 truncate max-w-[150px]">
                                            {slide.title}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                         {/* Layout Badge */}
                                         <div className="flex items-center gap-1 bg-black/30 px-2 py-0.5 rounded text-[10px] text-gray-500 border border-white/5">
                                            <i className={getLayoutIcon(slide.visual_layout)}></i>
                                            {slide.visual_layout || 'Auto'}
                                         </div>
                                    </div>
                                </div>

                                {/* Body: Narration Editor */}
                                <div className="p-3">
                                    <label className="text-[10px] text-gray-600 uppercase font-bold mb-1.5 block flex justify-between">
                                        <span>口播文案 (Narration)</span>
                                        <span className={`${slide.duration > 20 ? 'text-red-400' : 'text-green-500'}`}>
                                            ~{slide.duration}s
                                        </span>
                                    </label>
                                    <textarea
                                        value={slide.narration}
                                        onChange={(e) => handleNarrationChange(slide.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()} // Prevent card select when clicking text
                                        className={`
                                            w-full bg-black/20 text-sm text-gray-300 rounded p-2 focus:outline-none focus:ring-1 resize-none leading-relaxed transition-colors
                                            ${isActive ? 'focus:ring-blue-500 bg-black/40' : 'focus:ring-gray-600'}
                                        `}
                                        rows={4}
                                        placeholder="输入旁白..."
                                    />
                                </div>
                                
                                {/* Status Indicator */}
                                <div className="absolute right-2 bottom-2">
                                    {slide.isLoading ? (
                                        <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-xs"></i>
                                    ) : slide.isGenerated ? (
                                        <i className="fa-solid fa-check-circle text-green-600 text-xs opacity-50"></i>
                                    ) : (
                                        <i className="fa-regular fa-circle text-gray-700 text-xs"></i>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Add Scene Button */}
                    <button className="w-full py-3 border-2 border-dashed border-gray-800 rounded-xl text-gray-600 hover:border-gray-600 hover:text-gray-400 transition-colors flex items-center justify-center gap-2 text-sm font-medium">
                        <i className="fa-solid fa-plus"></i> 添加分镜
                    </button>
                </div>
            </div>

            {/* --- MIDDLE: LIVE STAGE (Preview) --- */}
            <div className="flex-1 flex flex-col bg-[#0F0F12] relative">
                {/* Toolbar */}
                <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0F0F12]">
                     <h3 className="text-gray-400 text-xs font-mono uppercase">Live Preview</h3>
                     <div className="flex gap-2">
                        {activeSlide && (
                            <button 
                                onClick={() => onGenerateVisual(activeSlide.id)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all"
                                disabled={activeSlide.isLoading}
                            >
                                {activeSlide.isLoading ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> 生成中...</>
                                ) : (
                                    <><i className="fa-solid fa-wand-magic-sparkles"></i> 
                                    {activeSlide.isGenerated ? '重新生成画面' : '生成画面'}
                                    </>
                                )}
                            </button>
                        )}
                     </div>
                </div>

                {/* Stage Area */}
                <div className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
                    {activeSlide ? (
                        <div className="aspect-video w-full max-w-5xl shadow-2xl rounded-lg overflow-hidden border border-gray-800 bg-[#1a1a1a] relative group">
                            
                            {/* The Slide Content */}
                            <div className="w-full h-full relative" style={{ backgroundColor: globalStyle.mainColor }}>
                                <SlideRenderer 
                                    html={activeSlide.content_html || `<div class='h-full flex items-center justify-center text-gray-600 flex-col gap-4'>
                                        <i class="fa-solid fa-clapperboard text-4xl mb-2"></i>
                                        <p>等待画面生成...</p>
                                        <div class="text-xs border border-gray-700 px-2 py-1 rounded">点击右上角生成按钮</div>
                                    </div>`}
                                    step={100} // Show all elements
                                    fontFamily={globalStyle.fontFamily}
                                />
                            </div>

                            {/* Narration Overlay (Subtitles Preview) */}
                            <div className="absolute bottom-8 left-0 w-full text-center z-10 px-12 pointer-events-none">
                                <span className="inline-block bg-black/70 backdrop-blur px-4 py-2 rounded-lg text-yellow-300 text-lg font-medium shadow-lg border border-white/10">
                                    {activeSlide.narration || "..."}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-600 flex flex-col items-center">
                            <i className="fa-solid fa-film text-4xl mb-4 opacity-30"></i>
                            <p>请在左侧选择一个分镜</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScriptStoryboard;
