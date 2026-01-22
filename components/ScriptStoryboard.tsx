
import React, { useState, useEffect, useRef } from 'react';
import { Slide, SlideLayoutType } from '../types';
import { calculateDuration, getLayoutIcon } from '../utils/scriptUtils';
import { SlideRenderer } from './PresentationRunner';
import { generateSpeech } from '../services/geminiService';
import { audioController } from '../utils/audioUtils';
import ScriptMarkerEditor from './ScriptMarkerEditor';
import { parseScriptAndAlign } from '../utils/timelineUtils';

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
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    // --- BROWSER TTS SUPPORT ---
    const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            const zhVoice = voices.find(v => v.lang.includes('zh') && v.name.includes('Google')) || 
                            voices.find(v => v.lang.includes('zh')) || 
                            voices[0];
            setVoice(zhVoice || null);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
    }, []);

    // Auto-scroll to active card
    useEffect(() => {
        if (activeSlideId && scrollRef.current) {
            const el = document.getElementById(`scene-card-${activeSlideId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }, [activeSlideId]);

    // Cleanup audio on unmount
    useEffect(() => {
        return () => {
            audioController.stop();
            window.speechSynthesis.cancel();
        };
    }, []);

    // --- HANDLERS ---

    const handleNarrationUpdate = (newText: string) => {
        if (!activeSlide) return;
        
        // Only update if text actually changed (Editor debounce helps, but double check)
        if (newText !== activeSlide.narration) {
             const { markers } = parseScriptAndAlign(newText, activeSlide.duration);
             
             // If manual edit, we might want to recalc duration based on text length roughly, 
             // BUT if we already have audio, this invalidates it.
             const isLengthChangeSig = Math.abs(newText.length - (activeSlide.narration?.length || 0)) > 5;
             let newDuration = activeSlide.duration;
             
             if (!activeSlide.audioData && isLengthChangeSig) {
                 newDuration = calculateDuration(newText);
             }

             onUpdateSlide(activeSlide.id, { 
                 narration: newText, 
                 markers, 
                 duration: newDuration,
                 audioData: undefined // Invalidate audio!
             });
        }
    };

    const handleGenerateAudio = async () => {
        if (!activeSlide || !activeSlide.narration) return;
        setIsGeneratingAudio(true);
        try {
            const audioBase64 = await generateSpeech(activeSlide.narration);
            if (audioBase64) {
                // Calculate precise duration from audio
                const preciseDuration = audioController.getDuration(audioBase64);
                
                onUpdateSlide(activeSlide.id, {
                    audioData: audioBase64,
                    duration: Math.ceil(preciseDuration) // Sync slide duration to audio length
                });
            }
        } catch (error) {
            alert("语音生成失败，请检查网络或 Key");
        } finally {
            setIsGeneratingAudio(false);
        }
    };

    const togglePreviewAudio = async () => {
        if (isPlaying) {
            audioController.stop();
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            return;
        }

        setIsPlaying(true);
        
        if (activeSlide?.audioData) {
            // Play AI Audio
            await audioController.play(activeSlide.audioData, () => setIsPlaying(false));
        } else {
            // Play Browser TTS
            const cleanText = activeSlide?.narration?.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, ' ') || '';
            if (cleanText) {
                const utterance = new SpeechSynthesisUtterance(cleanText);
                if (voice) utterance.voice = voice;
                utterance.rate = 1;
                utterance.onend = () => setIsPlaying(false);
                window.speechSynthesis.speak(utterance);
            } else {
                setIsPlaying(false);
            }
        }
    };

    return (
        <div className="flex h-full bg-[#0F0F12]">
            {/* --- LEFT: STORY STREAM (Script List) --- */}
            <div className="w-[300px] flex flex-col border-r border-gray-800 bg-[#141414] shrink-0">
                <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800 bg-[#1a1a1a]">
                    <h2 className="text-sm font-bold text-gray-200">
                        <i className="fa-solid fa-layer-group text-blue-500 mr-2"></i>分镜 (Scenes)
                    </h2>
                    <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">{slides.length}</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar" ref={scrollRef}>
                    {slides.map((slide, index) => {
                        const isActive = activeSlideId === slide.id;
                        return (
                            <div 
                                key={slide.id}
                                id={`scene-card-${slide.id}`}
                                onClick={() => onSelect(slide.id)}
                                className={`
                                    relative rounded-lg border transition-all cursor-pointer group p-3
                                    ${isActive 
                                        ? 'bg-[#1e1e1e] border-blue-500 shadow-md' 
                                        : 'bg-[#1a1a1a] border-gray-800 hover:border-gray-600 hover:bg-[#222]'}
                                `}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                                        {index + 1}
                                    </span>
                                    <div className="flex gap-1">
                                        {slide.audioData && <i className="fa-solid fa-microphone-lines text-[10px] text-green-500" title="Audio Ready"></i>}
                                        {slide.isGenerated && <i className="fa-solid fa-image text-[10px] text-blue-400" title="Visual Ready"></i>}
                                    </div>
                                </div>
                                <h3 className={`text-xs font-medium mb-1 line-clamp-2 ${isActive ? 'text-white' : 'text-gray-400'}`}>
                                    {slide.title}
                                </h3>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500">
                                    <i className={getLayoutIcon(slide.visual_layout)}></i>
                                    <span>{slide.duration}s</span>
                                </div>
                            </div>
                        );
                    })}
                    <button className="w-full py-2 border border-dashed border-gray-700 rounded-lg text-gray-500 hover:border-gray-500 hover:text-gray-300 text-xs transition-colors">
                        + 添加新分镜
                    </button>
                </div>
            </div>

            {/* --- MIDDLE: LIVE PREVIEW --- */}
            <div className="flex-1 flex flex-col bg-[#0F0F12] relative min-w-0">
                <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#0F0F12]">
                     <h3 className="text-gray-400 text-xs font-mono uppercase tracking-wider">
                        <i className="fa-solid fa-eye mr-2"></i>Live Preview
                     </h3>
                     {activeSlide && (
                        <button 
                            onClick={() => onGenerateVisual(activeSlide.id)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all
                                ${activeSlide.isGenerated 
                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg animate-pulse'}
                            `}
                            disabled={activeSlide.isLoading}
                        >
                            {activeSlide.isLoading ? (
                                <><i className="fa-solid fa-spinner fa-spin"></i> 生成中...</>
                            ) : (
                                <><i className="fa-solid fa-wand-magic-sparkles"></i> 
                                {activeSlide.isGenerated ? '重新生成画面' : '生成视觉 (Visual)'}
                                </>
                            )}
                        </button>
                     )}
                </div>

                <div className="flex-1 flex items-center justify-center p-6 lg:p-10 overflow-hidden relative bg-black/50">
                    {activeSlide ? (
                        <div className="aspect-video w-full max-w-4xl shadow-2xl rounded-lg overflow-hidden border border-gray-800 bg-[#1a1a1a] relative group">
                            {/* Visual Content */}
                            <div className="w-full h-full relative" style={{ backgroundColor: globalStyle.mainColor }}>
                                <SlideRenderer 
                                    html={activeSlide.content_html || `<div class='h-full flex items-center justify-center text-gray-600 flex-col gap-4'>
                                        <i class="fa-solid fa-clapperboard text-4xl mb-2 opacity-20"></i>
                                        <p class="text-sm opacity-50">Visual not generated yet</p>
                                    </div>`}
                                    step={100} 
                                    fontFamily={globalStyle.fontFamily}
                                />
                            </div>
                            
                            {/* Overlay Title for Context */}
                            <div className="absolute top-4 left-4 z-10">
                                <span className="bg-black/50 backdrop-blur text-white text-[10px] px-2 py-1 rounded border border-white/10">
                                    {activeSlide.title}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-600 flex flex-col items-center">
                            <i className="fa-solid fa-film text-4xl mb-4 opacity-30"></i>
                            <p className="text-xs">Select a scene to preview</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- RIGHT: INSPECTOR (Properties & Audio) --- */}
            <div className="w-[380px] flex flex-col border-l border-gray-800 bg-[#141414] shrink-0 z-10 shadow-xl">
                <div className="h-14 flex items-center px-4 border-b border-gray-800 bg-[#1a1a1a]">
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                        <i className="fa-solid fa-sliders mr-2 text-blue-500"></i>属性面板 (Inspector)
                    </span>
                </div>

                {activeSlide ? (
                    <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                        
                        {/* 1. AUDIO CONTROL */}
                        <div className="bg-[#1e1e1e] rounded-lg p-4 border border-gray-800 shadow-sm">
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-[10px] text-gray-500 uppercase font-bold">语音合成 (TTS)</label>
                                <div className="text-[10px]">
                                    {activeSlide.audioData ? (
                                        <span className="text-green-400 flex items-center gap-1"><i className="fa-brands fa-google"></i> Gemini AI</span>
                                    ) : (
                                        <span className="text-yellow-500 flex items-center gap-1"><i className="fa-solid fa-robot"></i> Browser Preview</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex gap-2 mb-3">
                                <button 
                                    onClick={handleGenerateAudio}
                                    disabled={isGeneratingAudio}
                                    className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all
                                        ${activeSlide.audioData 
                                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700' 
                                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:opacity-90 text-white shadow-lg'}
                                    `}
                                >
                                    {isGeneratingAudio ? (
                                        <><i className="fa-solid fa-circle-notch fa-spin"></i> 生成中...</>
                                    ) : (
                                        <><i className="fa-solid fa-microphone-lines"></i> {activeSlide.audioData ? '重新生成' : '生成 AI 语音'}</>
                                    )}
                                </button>
                                
                                <button 
                                    onClick={togglePreviewAudio}
                                    className={`w-12 rounded flex items-center justify-center border transition-colors
                                        ${isPlaying 
                                            ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30' 
                                            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'}
                                    `}
                                    title={isPlaying ? "Stop" : "Play Preview"}
                                >
                                    <i className={`fa-solid ${isPlaying ? 'fa-stop' : 'fa-play'}`}></i>
                                </button>
                            </div>

                            <div className="text-[10px] text-gray-500 flex justify-between bg-black/20 p-2 rounded">
                                <span>Duration: {activeSlide.duration}s</span>
                                <span>{activeSlide.narration?.length || 0} chars</span>
                            </div>
                        </div>

                        {/* 2. SCRIPT EDITOR */}
                        <div className="flex flex-col h-80">
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 flex justify-between items-center">
                                <span>脚本 & 锚点 (Script & Markers)</span>
                                <span className="text-[9px] text-yellow-500 bg-yellow-900/20 px-1.5 rounded">支持拖拽 ⚑</span>
                            </label>
                            
                            <ScriptMarkerEditor 
                                key={activeSlide.id} 
                                value={activeSlide.narration}
                                onChange={handleNarrationUpdate}
                            />
                        </div>

                        {/* 3. MARKER LIST */}
                        <div className="border-t border-gray-800 pt-4">
                            <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">
                                动画触发时机 (Timings)
                            </label>
                            <div className="space-y-1">
                                {activeSlide.markers?.length === 0 && <div className="text-xs text-gray-600 italic">在脚本中点击 "插入锚点" 添加动画...</div>}
                                {activeSlide.markers?.map((m) => (
                                    <div key={m.id} className="flex justify-between items-center bg-[#1e1e1e] px-2 py-1.5 rounded border border-gray-800 group hover:border-yellow-500/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="w-4 h-4 rounded bg-yellow-500/10 text-yellow-500 text-[9px] flex items-center justify-center font-bold">⚑</span>
                                            <span className="text-xs text-gray-300 font-mono">Step {m.id}</span>
                                        </div>
                                        <span className="text-xs text-blue-400 font-mono">
                                            {m.time}s
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center opacity-50">
                        <i className="fa-solid fa-sliders text-4xl mb-4"></i>
                        <p className="text-xs">选择分镜以编辑属性</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptStoryboard;
