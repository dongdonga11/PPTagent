
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Slide, GlobalStyle } from '../types';
import { SlideRenderer } from './PresentationRunner';
import { parseScriptAndAlign } from '../utils/timelineUtils';

interface VideoStageProps {
    slides: Slide[];
    globalStyle: GlobalStyle;
    onSlideUpdate: (id: string, updates: Partial<Slide>) => void;
}

const VideoStage: React.FC<VideoStageProps> = ({ slides, globalStyle, onSlideUpdate }) => {
    // --- STATE ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // in seconds
    const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
    
    // Refs
    const spokenSlideId = useRef<string | null>(null);

    // --- COMPUTED ---
    const totalDuration = useMemo(() => slides.reduce((acc, s) => acc + s.duration, 0), [slides]);
    
    // Determine which slide is active and local timeline info
    const activeSlideInfo = useMemo(() => {
        let elapsed = 0;
        for (let i = 0; i < slides.length; i++) {
            const slide = slides[i];
            const start = elapsed;
            const end = elapsed + slide.duration;
            if (currentTime >= start && currentTime < end) {
                return { 
                    index: i, 
                    slide, 
                    startTime: start,
                    localTime: currentTime - start
                };
            }
            elapsed += slide.duration;
        }
        // Fallback for end of timeline
        return { index: slides.length - 1, slide: slides[slides.length - 1], startTime: elapsed, localTime: 0 };
    }, [currentTime, slides]);

    // Calculate current animation step based on markers
    const currentAnimationStep = useMemo(() => {
        if (!activeSlideInfo.slide || !activeSlideInfo.slide.markers) return 0;
        // Count how many markers we have passed in local time
        const passedMarkers = activeSlideInfo.slide.markers.filter(m => m.time <= activeSlideInfo.localTime);
        return passedMarkers.length; // Step 0 = initial, Step 1 = after marker 1, etc.
    }, [activeSlideInfo]);

    const selectedSlide = useMemo(() => 
        slides.find(s => s.id === selectedSlideId) || null, 
    [slides, selectedSlideId]);

    // --- TTS ENGINE ---
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
        return () => window.speechSynthesis.cancel();
    }, []);

    // --- PLAYBACK LOGIC ---
    useEffect(() => {
        let interval: any;
        if (isPlaying) {
            const startTimestamp = Date.now() - currentTime * 1000;
            interval = setInterval(() => {
                const now = Date.now();
                const newTime = (now - startTimestamp) / 1000;
                
                if (newTime >= totalDuration) {
                    setCurrentTime(totalDuration);
                    setIsPlaying(false);
                    window.speechSynthesis.cancel();
                } else {
                    setCurrentTime(newTime);
                }
            }, 30);
        } else {
             window.speechSynthesis.pause();
             window.speechSynthesis.cancel();
             spokenSlideId.current = null;
        }
        return () => clearInterval(interval);
    }, [isPlaying, totalDuration]);

    // Trigger TTS
    useEffect(() => {
        if (!isPlaying || !activeSlideInfo.slide) return;
        const SLIDE_ID = activeSlideInfo.slide.id;
        
        if (spokenSlideId.current !== SLIDE_ID) {
            window.speechSynthesis.cancel();
            if (activeSlideInfo.slide.narration) {
                // Remove markers for speech
                const cleanText = activeSlideInfo.slide.narration.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, '');
                const utterance = new SpeechSynthesisUtterance(cleanText);
                if (voice) utterance.voice = voice;
                utterance.rate = 1;
                window.speechSynthesis.speak(utterance);
            }
            spokenSlideId.current = SLIDE_ID;
        }
    }, [activeSlideInfo.index, isPlaying, voice]);


    // --- HANDLERS ---
    const togglePlay = () => setIsPlaying(!isPlaying);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setCurrentTime(time);
        window.speechSynthesis.cancel();
        spokenSlideId.current = null;
    };

    const handleClipClick = (e: React.MouseEvent, slide: Slide, start: number) => {
        e.stopPropagation();
        setSelectedSlideId(slide.id);
        setCurrentTime(start); // Jump to start of clip
        setIsPlaying(false); // Pause editing
    };

    const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedSlide) return;
        const newDuration = Math.max(1, Number(e.target.value));
        // Need to re-align markers if duration changes? For now, keep absolute times or scale?
        // Let's just update duration.
        onSlideUpdate(selectedSlide.id, { duration: newDuration });
    };

    const handleNarrationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!selectedSlide) return;
        const newText = e.target.value;
        
        // Live parsing of markers when text changes
        // We preserve the Duration, but recalculate marker timestamps based on text flow
        const { markers } = parseScriptAndAlign(newText, selectedSlide.duration);

        onSlideUpdate(selectedSlide.id, { 
            narration: newText,
            markers: markers
        });
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 10);
        return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
    };

    return (
        <div className="flex flex-col h-full bg-gray-950">
            {/* 1. MONITOR (Top) */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 bg-[#0F0F12] relative border-b border-gray-800">
                <div className="aspect-video w-full max-w-4xl bg-black shadow-2xl relative overflow-hidden group border border-gray-800 rounded-lg">
                    {/* Visuals */}
                    <div className="w-full h-full relative" style={{ backgroundColor: globalStyle.mainColor }}>
                        {activeSlideInfo.slide && (
                            <SlideRenderer
                                key={activeSlideInfo.slide.id} 
                                html={activeSlideInfo.slide.content_html}
                                step={currentAnimationStep} // Driven by TIMELINE
                                fontFamily={globalStyle.fontFamily}
                            />
                        )}
                    </div>
                    {/* Subtitles (Cleaned) */}
                    <div className="absolute bottom-6 left-0 w-full px-12 text-center z-20 pointer-events-none">
                         <div className="inline-block bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                            <p className="text-lg font-medium text-yellow-300 drop-shadow-md font-sans">
                                {activeSlideInfo.slide?.narration?.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, ' ')}
                            </p>
                         </div>
                    </div>
                    {/* Controls Overlay */}
                    {!isPlaying && (
                        <button 
                            className="absolute inset-0 flex items-center justify-center bg-black/30 z-30 group-hover:bg-black/10 transition-colors"
                            onClick={togglePlay}
                        >
                            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur text-white flex items-center justify-center text-2xl shadow-lg border border-white/20 hover:scale-110 transition-transform">
                                <i className="fa-solid fa-play ml-1"></i>
                            </div>
                        </button>
                    )}
                </div>
                {/* Time Display */}
                <div className="absolute top-4 right-4 font-mono text-blue-400 bg-black/50 px-3 py-1 rounded text-sm border border-blue-900/30">
                    <span className="text-xs text-gray-400 mr-2">STEP {currentAnimationStep}</span>
                    {formatTime(currentTime)}
                </div>
            </div>

            {/* 2. EDITOR (Bottom) */}
            <div className="h-80 bg-[#161618] flex flex-col border-t border-gray-800 relative z-10">
                
                {/* Toolbar */}
                <div className="h-10 border-b border-gray-800 flex items-center justify-between px-4 bg-[#1e1e1e]">
                    <div className="flex gap-4 items-center">
                        <button onClick={togglePlay} className="text-gray-300 hover:text-white w-6">
                            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                        </button>
                        <div className="h-4 w-[1px] bg-gray-700"></div>
                        <span className="text-xs text-gray-500">Timeline Editor</span>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                            onClick={() => alert('导出功能需要配置 Remotion 后端服务')}
                        >
                            <i className="fa-solid fa-download mr-1"></i> 导出 MP4
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* A. TIMELINE TRACKS */}
                    <div className="flex-1 flex flex-col relative overflow-hidden">
                        {/* Ruler & Scrubber */}
                        <div className="h-8 bg-[#161618] border-b border-gray-800 relative select-none">
                            {/* Ruler Marks */}
                            <div className="absolute inset-0 flex items-end">
                                {Array.from({ length: Math.ceil(totalDuration / 5) + 1 }).map((_, i) => (
                                    <div key={i} className="absolute bottom-0 h-2 border-l border-gray-600 text-[9px] text-gray-500 pl-1 pb-3" 
                                         style={{ left: `${(i * 5 / totalDuration) * 100}%`}}>
                                        {formatTime(i * 5)}
                                    </div>
                                ))}
                            </div>
                            <input 
                                type="range" min={0} max={totalDuration} step={0.1}
                                value={currentTime} onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-50"
                            />
                            {/* Playhead */}
                            <div 
                                className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
                                style={{ left: `${(currentTime / totalDuration) * 100}%` }}
                            >
                                <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform -translate-y-1.5 shadow"></div>
                            </div>
                        </div>

                        {/* Tracks Area */}
                        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 relative bg-[#111] custom-scrollbar">
                            <div 
                                className="absolute top-0 bottom-0 w-px bg-red-500/50 z-30 pointer-events-none"
                                style={{ left: `calc(${(currentTime / totalDuration) * 100}% + 16px)` }} 
                            />

                            <div className="relative w-full h-full">
                                {/* Track 1: Slides & Markers */}
                                <div className="flex h-24 w-full bg-[#1a1a1a] rounded-lg overflow-hidden border border-gray-800">
                                    {slides.map((slide, index) => {
                                        let start = 0;
                                        for(let i=0; i<index; i++) start += slides[i].duration;
                                        
                                        const widthPercent = (slide.duration / totalDuration) * 100;
                                        const isSelected = selectedSlideId === slide.id;
                                        const isActive = activeSlideInfo.index === index;

                                        return (
                                            <div 
                                                key={slide.id}
                                                className={`h-full relative group cursor-pointer transition-all duration-200 border-r border-black/50
                                                    ${isSelected ? 'bg-blue-900/20 ring-1 ring-blue-500 z-10' : 'bg-gray-800 hover:bg-gray-700'}
                                                `}
                                                style={{ width: `${widthPercent}%` }}
                                                onClick={(e) => handleClipClick(e, slide, start)}
                                            >
                                                {/* Markers Flags */}
                                                {slide.markers?.map((marker, mIdx) => (
                                                    <div 
                                                        key={mIdx}
                                                        className="absolute top-0 bottom-0 w-px bg-yellow-500/50 z-20 group-hover:bg-yellow-500"
                                                        style={{ left: `${(marker.time / slide.duration) * 100}%` }}
                                                        title={`Marker ${marker.id}: ${marker.time}s`}
                                                    >
                                                        <div className="w-2 h-2 bg-yellow-500 text-[6px] text-black flex items-center justify-center rounded-sm -ml-1 mt-6 font-bold cursor-grab">
                                                            {marker.id}
                                                        </div>
                                                    </div>
                                                ))}

                                                <div className="p-2 h-full flex flex-col justify-between overflow-hidden relative">
                                                    <div className="flex items-center gap-2 z-10">
                                                        <span className={`text-[10px] font-bold px-1.5 rounded ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 truncate font-mono">
                                                            {slide.title}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] text-gray-500 text-right z-10">
                                                        {slide.duration}s
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* B. INSPECTOR (Right Side) */}
                    <div className="w-80 bg-[#161618] border-l border-gray-800 flex flex-col shadow-xl">
                        <div className="h-8 flex items-center px-4 bg-[#1e1e1e] border-b border-gray-800">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <i className="fa-solid fa-sliders mr-2"></i> 标记检查器
                            </span>
                        </div>
                        
                        {selectedSlide ? (
                            <div className="flex-1 p-4 overflow-y-auto space-y-6">
                                {/* Script Editing with Markers */}
                                <div className="flex-1 flex flex-col">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">包含标记的脚本</label>
                                    <textarea 
                                        value={selectedSlide.narration}
                                        onChange={handleNarrationChange}
                                        className="w-full bg-[#0F0F12] border border-gray-700 rounded p-3 text-xs text-gray-300 leading-relaxed focus:border-blue-500 focus:outline-none resize-none h-40 custom-scrollbar font-mono"
                                        placeholder="输入旁白，使用 [M] 标记动画点..."
                                    />
                                    <p className="text-[10px] text-gray-500 mt-2 flex items-center gap-1">
                                        <i className="fa-solid fa-circle-info text-blue-400"></i>
                                        提示：插入 <code>[M]</code> 来触发下一步动画。
                                    </p>
                                </div>

                                {/* Marker List */}
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">锚点列表 (自动计算)</label>
                                    <div className="space-y-1">
                                        {selectedSlide.markers?.length === 0 && <div className="text-xs text-gray-600">无动画标记</div>}
                                        {selectedSlide.markers?.map((m) => (
                                            <div key={m.id} className="flex justify-between items-center bg-black/20 px-2 py-1 rounded border border-gray-800">
                                                <span className="text-xs text-yellow-500 font-mono font-bold">Marker {m.id}</span>
                                                <span className="text-xs text-gray-400">@ {m.time}s</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 p-8 text-center">
                                <i className="fa-solid fa-arrow-pointer text-2xl mb-2 opacity-50"></i>
                                <p className="text-xs">选择时间轴上的片段以编辑锚点</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoStage;
