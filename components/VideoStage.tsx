
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Slide, GlobalStyle } from '../types';
import { SlideRenderer } from './PresentationRunner';
import { parseScriptAndAlign } from '../utils/timelineUtils';
import { generateSpeech } from '../services/geminiService';
import { audioController } from '../utils/audioUtils';
import ScriptMarkerEditor from './ScriptMarkerEditor';

interface VideoStageProps {
    slides: Slide[];
    globalStyle: GlobalStyle;
    onSlideUpdate: (id: string, updates: Partial<Slide>) => void;
    // New CRUD Props
    onAddSlide: () => void;
    onDeleteSlide: (id: string) => void;
    onDuplicateSlide: (id: string) => void;
    onMoveSlide: (id: string, direction: number) => void;
    onSplitSlide: (id: string, splitOffset: number) => void; // NEW
}

const VideoStage: React.FC<VideoStageProps> = ({ 
    slides, 
    globalStyle, 
    onSlideUpdate,
    onAddSlide,
    onDeleteSlide,
    onDuplicateSlide,
    onMoveSlide,
    onSplitSlide
}) => {
    // --- STATE ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // in seconds
    const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    
    // Dragging State for Trimming
    const [isDragging, setIsDragging] = useState(false);
    const dragStartXRef = useRef<number>(0);
    const dragStartDurationRef = useRef<number>(0);
    const draggingSlideIdRef = useRef<string | null>(null);

    // Refs
    const playingSlideId = useRef<string | null>(null);
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const trackContainerRef = useRef<HTMLDivElement>(null);

    // --- BROWSER TTS STATE (Fallback) ---
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
        if (slides.length > 0) {
             const last = slides[slides.length - 1];
             return { index: slides.length - 1, slide: last, startTime: totalDuration - last.duration, localTime: last.duration };
        }
        return { index: -1, slide: null, startTime: 0, localTime: 0 };
    }, [currentTime, slides, totalDuration]);

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
                    audioController.stop();
                    window.speechSynthesis.cancel();
                    playingSlideId.current = null;
                } else {
                    setCurrentTime(newTime);
                }
            }, 30);
        } else {
             audioController.stop();
             window.speechSynthesis.cancel();
             playingSlideId.current = null;
        }
        return () => clearInterval(interval);
    }, [isPlaying, totalDuration]);

    // --- AUDIO SYNC ---
    useEffect(() => {
        if (!isPlaying || !activeSlideInfo.slide) return;
        const SLIDE_ID = activeSlideInfo.slide.id;
        
        // If we crossed into a new slide while playing
        if (playingSlideId.current !== SLIDE_ID) {
            
            // Stop previous sounds (both engines)
            audioController.stop();
            window.speechSynthesis.cancel();
            
            // Play new audio
            if (activeSlideInfo.slide.audioData) {
                // Priority 1: High Quality AI Audio
                audioController.play(activeSlideInfo.slide.audioData).catch(err => console.error("Audio Play Error", err));
            } else {
                // Priority 2: Browser TTS Fallback
                console.log(`[Playback] Slide ${SLIDE_ID}: No AI audio found. Using Browser TTS.`);
                const cleanText = activeSlideInfo.slide.narration?.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, ' ') || '';
                if (cleanText) {
                    const utterance = new SpeechSynthesisUtterance(cleanText);
                    if (voice) utterance.voice = voice;
                    utterance.rate = 1;
                    window.speechSynthesis.speak(utterance);
                }
            }
            
            playingSlideId.current = SLIDE_ID;
        }
    }, [activeSlideInfo.index, isPlaying, voice]); // Depend on index change


    // --- HANDLERS ---
    const togglePlay = () => setIsPlaying(!isPlaying);
    
    const toggleFullscreen = () => {
        if (!playerContainerRef.current) return;
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setCurrentTime(time);
        audioController.stop();
        window.speechSynthesis.cancel();
        playingSlideId.current = null;
    };

    const handleClipClick = (e: React.MouseEvent, slide: Slide, start: number) => {
        e.stopPropagation();
        setSelectedSlideId(slide.id);
        setCurrentTime(start); // Jump to start of clip
        setIsPlaying(false); // Pause editing
    };

    // --- TRIM / RESIZE LOGIC ---
    const handleTrimStart = (e: React.MouseEvent, slide: Slide) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        dragStartXRef.current = e.clientX;
        dragStartDurationRef.current = slide.duration;
        draggingSlideIdRef.current = slide.id;

        // Add listeners
        document.addEventListener('mousemove', handleTrimMove);
        document.addEventListener('mouseup', handleTrimEnd);
    };

    const handleTrimMove = (e: MouseEvent) => {
        if (!draggingSlideIdRef.current || !trackContainerRef.current) return;
        
        const deltaPixels = e.clientX - dragStartXRef.current;
        // Calculate conversion: Total Width / Total Duration = Pixels Per Second
        const trackWidth = trackContainerRef.current.offsetWidth;
        // Approximation: since we are resizing, total duration changes! 
        // We use the *current* state as base to avoid infinite resizing loop jitter.
        const pixelsPerSecond = trackWidth / totalDuration;
        
        const deltaSeconds = deltaPixels / pixelsPerSecond;
        const newDuration = Math.max(1, dragStartDurationRef.current + deltaSeconds); // Min 1s
        
        // Optimistic update? Or just wait for mouse up to prevent expensive re-renders?
        // Let's do live update for smooth feel, but debounce could be better.
        onSlideUpdate(draggingSlideIdRef.current, { duration: Number(newDuration.toFixed(2)) });
    };

    const handleTrimEnd = () => {
        setIsDragging(false);
        draggingSlideIdRef.current = null;
        document.removeEventListener('mousemove', handleTrimMove);
        document.removeEventListener('mouseup', handleTrimEnd);
    };


    const handleSplitAction = () => {
        if (isPlaying) {
            togglePlay(); // Pause first
        }
        
        if (!selectedSlide) {
            // If nothing selected, try to split under playhead
            if (activeSlideInfo.slide) {
                onSplitSlide(activeSlideInfo.slide.id, activeSlideInfo.localTime);
            }
            return;
        }

        // Split selected slide
        // We need the relative time inside that slide.
        // If playhead is inside, use playhead.
        // If playhead is outside, this action is ambiguous, but let's assume "Split at Playhead" is the intent.
        if (activeSlideInfo.slide?.id === selectedSlide.id) {
             onSplitSlide(selectedSlide.id, activeSlideInfo.localTime);
        } else {
            alert("请将播放指针移动到选中的片段范围内进行剪辑。");
        }
    };

    const handleNarrationChange = (newText: string) => {
        if (!selectedSlide) return;
        const { markers } = parseScriptAndAlign(newText, selectedSlide.duration);
        if (newText !== selectedSlide.narration) {
            onSlideUpdate(selectedSlide.id, { 
                narration: newText,
                markers: markers,
                audioData: undefined // Invalidate old audio
            });
        }
    };

    const handleGenerateAudio = async () => {
        if (!selectedSlide || !selectedSlide.narration) return;
        setIsGeneratingAudio(true);
        try {
            const audioBase64 = await generateSpeech(selectedSlide.narration);
            if (audioBase64) {
                const preciseDuration = audioController.getDuration(audioBase64);
                onSlideUpdate(selectedSlide.id, {
                    audioData: audioBase64,
                    duration: Math.ceil(preciseDuration)
                });
            }
        } catch (error) {
            alert("语音生成失败，请重试");
        } finally {
            setIsGeneratingAudio(false);
        }
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
                <div 
                    ref={playerContainerRef}
                    className="aspect-video w-full max-w-4xl bg-black shadow-2xl relative overflow-hidden group border border-gray-800 rounded-lg"
                >
                    {/* Visuals */}
                    <div className="w-full h-full relative" style={{ backgroundColor: globalStyle.mainColor }}>
                        {activeSlideInfo.slide && (
                            <SlideRenderer
                                key={activeSlideInfo.slide.id} 
                                html={activeSlideInfo.slide.content_html}
                                step={currentAnimationStep} 
                                fontFamily={globalStyle.fontFamily}
                            />
                        )}
                    </div>
                    {/* Subtitles */}
                    <div className="absolute bottom-6 left-0 w-full px-12 text-center z-20 pointer-events-none">
                         <div className="inline-block bg-black/60 backdrop-blur-md px-4 py-2 rounded-lg border border-white/10">
                            <p className="text-lg font-medium text-yellow-300 drop-shadow-md font-sans">
                                {activeSlideInfo.slide?.narration?.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, ' ')}
                            </p>
                         </div>
                    </div>
                    {/* Controls Overlay */}
                    <div className="absolute inset-0 z-30 opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none flex flex-col justify-end p-4 bg-gradient-to-t from-black/50 to-transparent">
                        <div className="flex justify-between items-end pointer-events-auto">
                            {!isPlaying && (
                                <button 
                                    className="w-12 h-12 rounded-full bg-white/20 backdrop-blur hover:bg-white/40 flex items-center justify-center text-white"
                                    onClick={togglePlay}
                                >
                                    <i className="fa-solid fa-play"></i>
                                </button>
                            )}
                            <button 
                                onClick={toggleFullscreen}
                                className="w-8 h-8 rounded bg-black/50 hover:bg-black/80 text-white flex items-center justify-center border border-white/20 ml-auto"
                            >
                                <i className="fa-solid fa-expand"></i>
                            </button>
                        </div>
                    </div>

                     {/* Pause Overlay Big Icon */}
                    {!isPlaying && (
                        <div 
                            className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer"
                            onClick={togglePlay}
                        >
                             <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur flex items-center justify-center text-white/80 border border-white/10">
                                <i className="fa-solid fa-play ml-1 text-2xl"></i>
                             </div>
                        </div>
                    )}
                </div>
                
                {/* Time Display */}
                <div className="absolute top-4 right-4 font-mono text-blue-400 bg-black/50 px-3 py-1 rounded text-sm border border-blue-900/30">
                    <span className="text-xs text-gray-400 mr-2">STEP {currentAnimationStep}</span>
                    {formatTime(currentTime)} <span className="text-gray-600">/ {formatTime(totalDuration)}</span>
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
                        
                        {/* Cut Tool */}
                        <button 
                            onClick={handleSplitAction}
                            className="text-xs px-3 py-1.5 rounded flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
                            title="Split Clip at Playhead (Ctrl+K)"
                        >
                            <i className="fa-solid fa-scissors text-yellow-500"></i> 剪辑 (Cut)
                        </button>

                         <button 
                            onClick={() => selectedSlideId && onDeleteSlide(selectedSlideId)}
                            className={`text-xs px-3 py-1.5 rounded flex items-center gap-2 border border-gray-700 ${selectedSlideId ? 'bg-gray-800 hover:bg-red-900/50 text-red-400' : 'text-gray-600 cursor-not-allowed'}`}
                            disabled={!selectedSlideId}
                        >
                            <i className="fa-solid fa-trash"></i> 删除
                        </button>
                    </div>
                    <div className="flex gap-2">
                         <button 
                            className="text-xs px-2 py-1 rounded bg-blue-900/50 text-blue-300 border border-blue-800 hover:bg-blue-800 transition-colors"
                            onClick={() => alert("合成渲染功能需连接 Remotion 后端服务。当前仅为 Web 预览。")}
                         >
                            <i className="fa-solid fa-file-export mr-1"></i> 导出 Render
                         </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    
                    {/* A. TRACK HEADERS (Left Sidebar) */}
                    <div className="w-24 flex-shrink-0 bg-[#111] border-r border-gray-800 flex flex-col pt-8 text-[10px] font-bold text-gray-500 select-none">
                        <div className="h-24 flex items-center justify-center border-b border-gray-800 bg-[#161616]">
                            <span>VIDEO 1</span>
                        </div>
                        <div className="h-16 flex items-center justify-center border-b border-gray-800 bg-[#161616]">
                            <span>AUDIO 1</span>
                        </div>
                    </div>

                    {/* B. TIMELINE TRACKS (Right Scrollable) */}
                    <div className="flex-1 flex flex-col relative overflow-hidden bg-[#0a0a0a]">
                        
                        {/* 1. Ruler */}
                        <div className="h-8 bg-[#161618] border-b border-gray-800 relative select-none w-full">
                            <div className="absolute inset-0 flex items-end pointer-events-none">
                                {Array.from({ length: Math.ceil(totalDuration / 5) + 2 }).map((_, i) => (
                                    <div key={i} className="absolute bottom-0 h-2 border-l border-gray-600 text-[9px] text-gray-500 pl-1 pb-3" 
                                         style={{ left: `${(i * 5 / (totalDuration || 1)) * 100}%`}}>
                                        {formatTime(i * 5)}
                                    </div>
                                ))}
                            </div>
                            {/* Scrubber Input */}
                            <input 
                                type="range" min={0} max={totalDuration || 1} step={0.1}
                                value={currentTime} onChange={handleSeek}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-50"
                            />
                            {/* Playhead */}
                            <div 
                                className="absolute top-0 bottom-0 w-px bg-red-500 z-40 pointer-events-none"
                                style={{ left: `${(currentTime / (totalDuration || 1)) * 100}%` }}
                            >
                                <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform -translate-y-1.5 shadow"></div>
                            </div>
                        </div>

                        {/* 2. Tracks Container */}
                        <div className="flex-1 overflow-x-auto overflow-y-hidden relative custom-scrollbar">
                            <div 
                                ref={trackContainerRef}
                                className="relative h-full min-w-full" 
                                style={{ width: '100%' }}
                            >
                                
                                {/* Global Playhead Line (Vertical) */}
                                <div 
                                    className="absolute top-0 bottom-0 w-px bg-red-500/50 z-30 pointer-events-none"
                                    style={{ left: `${(currentTime / (totalDuration || 1)) * 100}%` }} 
                                />

                                {/* TRACK 1: VIDEO (Slides) */}
                                <div className="flex h-24 w-full bg-[#1a1a1a] border-b border-gray-800 items-center">
                                    {slides.map((slide, index) => {
                                        const widthPercent = (slide.duration / (totalDuration || 1)) * 100;
                                        const isSelected = selectedSlideId === slide.id;
                                        let start = 0;
                                        for(let i=0; i<index; i++) start += slides[i].duration;

                                        return (
                                            <div 
                                                key={slide.id}
                                                className={`h-[90%] relative group cursor-pointer transition-all duration-75 border-r border-black/50 overflow-hidden mx-[1px] rounded-sm
                                                    ${isSelected ? 'bg-indigo-900/40 ring-2 ring-indigo-500 z-10' : 'bg-gray-800 hover:bg-gray-700'}
                                                `}
                                                style={{ width: `${widthPercent}%`, minWidth: '60px' }}
                                                onClick={(e) => handleClipClick(e, slide, start)}
                                            >
                                                {/* Markers Dots */}
                                                {slide.markers?.map((marker, mIdx) => (
                                                    <div 
                                                        key={mIdx}
                                                        className="absolute top-0 bottom-0 w-px bg-yellow-400/30 z-0 pointer-events-none"
                                                        style={{ left: `${(marker.time / slide.duration) * 100}%` }}
                                                    >
                                                        <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full -ml-[3px] mt-1"></div>
                                                    </div>
                                                ))}

                                                {/* Clip Content */}
                                                <div className="p-2 h-full flex flex-col justify-between relative z-10">
                                                    <div className="flex justify-between items-start">
                                                        <span className={`text-[9px] font-bold px-1 rounded ${isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                                                            {index + 1}
                                                        </span>
                                                        <span className="text-[9px] text-gray-400">{slide.duration}s</span>
                                                    </div>
                                                    <span className="text-[10px] text-gray-300 truncate font-mono w-full block">
                                                        {slide.title}
                                                    </span>
                                                </div>

                                                {/* TRIM HANDLES (Only when selected) */}
                                                {isSelected && (
                                                    <div 
                                                        className="absolute top-0 bottom-0 right-0 w-2 cursor-col-resize z-50 bg-indigo-500/50 hover:bg-indigo-400"
                                                        onMouseDown={(e) => handleTrimStart(e, slide)}
                                                    ></div>
                                                )}

                                                {/* HOVER ACTIONS (The Insert/Edit functionality) */}
                                                <div className="absolute inset-0 bg-black/80 hidden group-hover:flex items-center justify-center gap-1 z-40 backdrop-blur-sm">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, -1); }}
                                                        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-[10px]"
                                                        title="向前移动"
                                                    >
                                                        <i className="fa-solid fa-chevron-left"></i>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onDuplicateSlide(slide.id); }}
                                                        className="w-5 h-5 rounded bg-blue-900/50 hover:bg-blue-600 text-blue-200 hover:text-white flex items-center justify-center text-[10px]"
                                                        title="复制"
                                                    >
                                                        <i className="fa-solid fa-copy"></i>
                                                    </button>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); onMoveSlide(slide.id, 1); }}
                                                        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-white flex items-center justify-center text-[10px]"
                                                        title="向后移动"
                                                    >
                                                        <i className="fa-solid fa-chevron-right"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Add Slide Button at End */}
                                    <button 
                                        onClick={onAddSlide}
                                        className="h-[80%] w-12 mx-2 border border-dashed border-gray-600 rounded flex items-center justify-center text-gray-500 hover:text-white hover:border-gray-400 transition-colors"
                                        title="添加新场景"
                                    >
                                        <i className="fa-solid fa-plus"></i>
                                    </button>
                                </div>

                                {/* TRACK 2: AUDIO (BGM Visualization Placeholder) */}
                                <div className="flex h-16 w-full bg-[#111] border-b border-gray-800 items-center relative overflow-hidden">
                                     {/* Fake Waveform Pattern */}
                                     <div className="absolute inset-0 opacity-20 flex items-center gap-[2px]">
                                        {Array.from({ length: 100 }).map((_, i) => (
                                            <div key={i} className="w-1 bg-green-500 rounded-full" style={{ height: `${Math.random() * 80 + 20}%` }}></div>
                                        ))}
                                     </div>
                                     <span className="relative z-10 text-[10px] text-gray-500 ml-4 bg-black/50 px-2 py-1 rounded border border-gray-700">
                                        <i className="fa-solid fa-music mr-2"></i> Background Music (Placeholder)
                                     </span>
                                </div>

                            </div>
                        </div>
                    </div>

                    {/* C. INSPECTOR (Right Side) */}
                    <div className="w-80 bg-[#161618] border-l border-gray-800 flex flex-col shadow-xl flex-shrink-0">
                        <div className="h-8 flex items-center px-4 bg-[#1e1e1e] border-b border-gray-800">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                <i className="fa-solid fa-sliders mr-2"></i> 语音与标记
                            </span>
                        </div>
                        
                        {selectedSlide ? (
                            <div className="flex-1 p-4 overflow-y-auto space-y-6">
                                {/* Audio Generator */}
                                <div className="bg-black/30 rounded p-3 border border-gray-800">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-[10px] text-gray-500 uppercase font-bold">音频源 (Audio Source)</label>
                                        <div className="text-[10px]">
                                            {selectedSlide.audioData ? (
                                                <span className="text-green-400 flex items-center gap-1"><i className="fa-brands fa-google"></i> Gemini TTS</span>
                                            ) : (
                                                <span className="text-gray-500 flex items-center gap-1"><i className="fa-solid fa-globe"></i> Browser TTS (Fallback)</span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleGenerateAudio}
                                        disabled={isGeneratingAudio}
                                        className={`w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-2 transition-all
                                            ${selectedSlide.audioData 
                                                ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white shadow-lg'}
                                        `}
                                    >
                                        {isGeneratingAudio ? (
                                            <><i className="fa-solid fa-circle-notch fa-spin"></i> 生成中...</>
                                        ) : (
                                            <><i className="fa-solid fa-wand-magic-sparkles"></i> {selectedSlide.audioData ? '重新生成 AI 语音' : '生成 AI 语音 (High Quality)'}</>
                                        )}
                                    </button>
                                </div>

                                {/* Script Editing with Markers */}
                                <div className="flex-1 flex flex-col h-64">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">脚本编辑器 (可拖拽锚点)</label>
                                    <ScriptMarkerEditor 
                                        key={selectedSlide.id}
                                        value={selectedSlide.narration}
                                        onChange={handleNarrationChange}
                                    />
                                </div>

                                {/* Marker List */}
                                <div>
                                    <label className="text-[10px] text-gray-500 uppercase font-bold block mb-2">锚点列表</label>
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
                                <p className="text-xs">选择时间轴上的片段以编辑</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoStage;
