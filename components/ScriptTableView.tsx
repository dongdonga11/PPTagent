
import React, { useState } from 'react';
import { Slide } from '../types';
import { SlideRenderer } from './PresentationRunner';
import { getLayoutIcon, calculateDuration } from '../utils/scriptUtils';
import { parseScriptAndAlign } from '../utils/timelineUtils';
import { refineTextWithAI } from '../services/geminiService';

interface ScriptTableViewProps {
    slides: Slide[];
    globalStyle: any;
    onUpdateSlide: (id: string, updates: Partial<Slide>) => void;
    onGenerateVisual: (id: string) => void;
    onSelectSlide: (id: string) => void;
}

const ScriptTableView: React.FC<ScriptTableViewProps> = ({ 
    slides, 
    globalStyle, 
    onUpdateSlide, 
    onGenerateVisual,
    onSelectSlide
}) => {
    // Local state for text processing loading indicators
    const [processingTextId, setProcessingTextId] = useState<string | null>(null);

    const handleNarrationChange = (id: string, text: string, currentDuration: number) => {
        // Recalculate duration if significant change and no audio locked
        // For MVP in table view, we do a simple recalc based on length if text changes
        const { markers } = parseScriptAndAlign(text, currentDuration);
        const newDuration = calculateDuration(text);
        
        onUpdateSlide(id, { 
            narration: text,
            markers,
            // Only update duration if it wasn't manually set to something specific (heuristics here are tricky, keeping it simple)
            duration: newDuration, 
            audioData: undefined // Invalidate audio
        });
    };

    const handlePolishNarration = async (slide: Slide) => {
        if (!slide.narration) return;
        setProcessingTextId(slide.id);
        try {
            const refined = await refineTextWithAI(
                slide.narration, 
                "Rewrite this script segment to be more engaging, concise, and spoken-style (oral presentation). Keep it roughly the same length."
            );
            
            // Recalc properties for new text
            const newDuration = calculateDuration(refined);
            const { markers } = parseScriptAndAlign(refined, newDuration);
            
            onUpdateSlide(slide.id, { 
                narration: refined,
                markers: markers,
                duration: newDuration,
                audioData: undefined
            });
        } catch (e) {
            console.error(e);
            alert("AI Optimization failed");
        } finally {
            setProcessingTextId(null);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, slide: Slide) => {
        // Ctrl+M to insert marker
        if ((e.ctrlKey || e.metaKey) && (e.key === 'm' || e.key === 'M')) {
            e.preventDefault();
            const textarea = e.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;
            const newText = text.substring(0, start) + ' [M] ' + text.substring(end);
            
            // Update
            handleNarrationChange(slide.id, newText, slide.duration);
            
            // Restore cursor (delayed slightly for React render)
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 5;
            }, 0);
        }
    };

    return (
        <div className="flex-1 bg-[#1a1a1a] overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-[1600px] mx-auto">
                <div className="mb-6 flex justify-between items-end">
                    <div>
                        <h2 className="text-xl font-bold text-gray-200">A2S 脚本概览 (AV Script Table)</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            <span className="bg-gray-800 px-2 py-0.5 rounded border border-gray-700 mr-2">Ctrl + M</span> 
                            插入动画锚点
                        </p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                        共 {slides.length} 个分镜 · 总时长 ≈ {Math.floor(slides.reduce((acc,s)=>acc+s.duration,0)/60)}分{slides.reduce((acc,s)=>acc+s.duration,0)%60}秒
                    </div>
                </div>

                <div className="rounded-lg border border-gray-800 bg-[#0f0f12] overflow-hidden shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1e1e1e] text-xs font-bold text-gray-400 border-b border-gray-800">
                                <th className="p-4 w-16 text-center">#</th>
                                <th className="p-4 w-24">时长 (T)</th>
                                <th className="p-4 w-[40%]">口播文案 (Audio & Markers)</th>
                                <th className="p-4 w-[35%]">画面指令 (Visual Config)</th>
                                <th className="p-4 text-right">AI 操作</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-800/50">
                            {slides.map((slide, index) => (
                                <tr key={slide.id} className="hover:bg-[#161618] transition-colors group">
                                    {/* Index */}
                                    <td className="p-4 text-center font-mono text-gray-500">
                                        {index + 1}
                                    </td>
                                    
                                    {/* Duration */}
                                    <td className="p-4 align-top">
                                        <div className="flex items-center bg-black/30 rounded border border-gray-800 px-2 py-1 w-20">
                                            <input 
                                                type="number" 
                                                value={slide.duration}
                                                onChange={(e) => onUpdateSlide(slide.id, { duration: Number(e.target.value) })}
                                                className="bg-transparent text-blue-400 font-mono w-full text-center focus:outline-none"
                                            />
                                            <span className="text-gray-600 text-xs ml-1">s</span>
                                        </div>
                                    </td>

                                    {/* Narration */}
                                    <td className="p-4 align-top">
                                        <textarea 
                                            value={slide.narration}
                                            onChange={(e) => handleNarrationChange(slide.id, e.target.value, slide.duration)}
                                            onKeyDown={(e) => handleKeyDown(e, slide)}
                                            className="w-full bg-[#111] border border-gray-800 rounded p-3 text-gray-300 focus:border-blue-500 focus:outline-none focus:bg-[#000] transition-colors resize-none leading-relaxed font-sans min-h-[100px]"
                                            placeholder="输入口播文案，使用 Ctrl+M 插入动作标记..."
                                        />
                                        {slide.markers && slide.markers.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {slide.markers.map(m => (
                                                    <span key={m.id} className="text-[10px] bg-yellow-900/30 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-900/50">
                                                        ⚑ {m.time}s
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </td>

                                    {/* Visual Config */}
                                    <td className="p-4 align-top">
                                        <div className="flex gap-4">
                                            {/* Mini Preview */}
                                            <div 
                                                className="w-40 aspect-video bg-black rounded border border-gray-800 overflow-hidden relative shadow-lg cursor-pointer hover:ring-2 ring-blue-500 transition-all shrink-0"
                                                onClick={() => onSelectSlide(slide.id)} // Jump to storyboard mode ideally, or logic to edit
                                            >
                                                <div className="w-[800px] h-[450px] origin-top-left transform scale-[0.2]" style={{ backgroundColor: globalStyle.mainColor }}>
                                                    {slide.isGenerated ? (
                                                        <SlideRenderer 
                                                            html={slide.content_html} 
                                                            step={100} 
                                                            fontFamily={globalStyle.fontFamily} 
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-4xl text-gray-700">
                                                            <i className={getLayoutIcon(slide.visual_layout)}></i>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Metadata Info */}
                                            <div className="flex-1 flex flex-col gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded flex items-center gap-1">
                                                        <i className={getLayoutIcon(slide.visual_layout)}></i>
                                                        {slide.visual_layout}
                                                    </span>
                                                    {slide.isGenerated ? (
                                                        <span className="text-[10px] text-green-500 flex items-center gap-1"><i className="fa-solid fa-check-circle"></i> Ready</span>
                                                    ) : (
                                                        <span className="text-[10px] text-gray-600">Pending</span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 line-clamp-2" title={slide.visual_intent}>
                                                    Intent: {slide.visual_intent}
                                                </div>
                                                <div className="mt-auto">
                                                    <button 
                                                        onClick={() => onSelectSlide(slide.id)}
                                                        className="text-[10px] text-blue-400 hover:text-white underline decoration-dashed underline-offset-4"
                                                    >
                                                        配置画面参数 &gt;
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Actions */}
                                    <td className="p-4 align-top text-right">
                                        <div className={`flex flex-col gap-2 items-end transition-opacity ${slide.isLoading || processingTextId === slide.id ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
                                            <button 
                                                onClick={() => onGenerateVisual(slide.id)}
                                                disabled={slide.isLoading}
                                                className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-2 w-28 justify-center
                                                    ${slide.isLoading 
                                                        ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-wait' 
                                                        : 'bg-gray-800 hover:bg-blue-600 hover:text-white text-gray-300 border-gray-700'
                                                    }
                                                `}
                                                title="Re-run AI Coder"
                                            >
                                                {slide.isLoading ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>} 
                                                {slide.isLoading ? '生成中...' : (slide.isGenerated ? '重绘画面' : '生成画面')}
                                            </button>
                                            <button 
                                                onClick={() => handlePolishNarration(slide)}
                                                disabled={processingTextId === slide.id}
                                                className={`text-xs px-3 py-1.5 rounded border transition-colors flex items-center gap-2 w-28 justify-center
                                                     ${processingTextId === slide.id
                                                        ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-wait' 
                                                        : 'bg-gray-800 hover:bg-purple-600 hover:text-white text-gray-300 border-gray-700'
                                                    }
                                                `}
                                                title="AI Rewrite Narration"
                                            >
                                                {processingTextId === slide.id ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-pen-nib"></i>}
                                                {processingTextId === slide.id ? '润色中...' : '润色文案'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-8 text-center">
                    <button className="px-6 py-3 bg-[#1e1e1e] hover:bg-[#252525] text-gray-400 hover:text-white rounded-lg border border-dashed border-gray-700 transition-colors">
                        + 添加新分镜行 (Add Scene)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ScriptTableView;
