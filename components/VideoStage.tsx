import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Slide, GlobalStyle } from '../types';
import { SlideRenderer } from './PresentationRunner';

interface VideoStageProps {
    slides: Slide[];
    globalStyle: GlobalStyle;
}

const VideoStage: React.FC<VideoStageProps> = ({ slides, globalStyle }) => {
    // --- STATE ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0); // in seconds
    const requestRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const lastPauseTimeRef = useRef<number>(0);

    // --- COMPUTED ---
    const totalDuration = useMemo(() => slides.reduce((acc, s) => acc + s.duration, 0), [slides]);
    
    // Determine which slide is active based on currentTime
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
                    localTime: currentTime - start,
                    progress: (currentTime - start) / slide.duration 
                };
            }
            elapsed += slide.duration;
        }
        // End of video
        return { index: slides.length - 1, slide: slides[slides.length - 1], localTime: 0, progress: 1 };
    }, [currentTime, slides]);

    // --- TTS ENGINE (Browser Native) ---
    const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

    // Init Voice
    useEffect(() => {
        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices();
            // Try to find a good Chinese voice
            const zhVoice = voices.find(v => v.lang.includes('zh') && v.name.includes('Google')) || 
                            voices.find(v => v.lang.includes('zh')) || 
                            voices[0];
            setVoice(zhVoice || null);
        };
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => window.speechSynthesis.cancel(); // Cleanup
    }, []);

    // Sync Audio with Playback State
    useEffect(() => {
        if (isPlaying) {
            // If playing, we need to speak the current segment if not already speaking
            // BUT, browser TTS is event-based, not seekable. 
            // Simple logic: When slide changes, speak.
        } else {
            window.speechSynthesis.pause();
            // or cancel() if we want to reset
            window.speechSynthesis.cancel(); 
        }
    }, [isPlaying]);

    // Trigger TTS on Slide Change
    const spokenSlideId = useRef<string | null>(null);
    useEffect(() => {
        if (!isPlaying || !activeSlideInfo.slide) return;
        
        // Only speak if we just entered a new slide AND we are at the beginning (ish)
        // This is a simplified "Timeline Preview" logic.
        // In a real export, we would generate an MP3 file.
        const SLIDE_ID = activeSlideInfo.slide.id;
        
        if (spokenSlideId.current !== SLIDE_ID) {
            window.speechSynthesis.cancel(); // Stop previous
            if (activeSlideInfo.slide.narration) {
                const utterance = new SpeechSynthesisUtterance(activeSlideInfo.slide.narration);
                if (voice) utterance.voice = voice;
                utterance.rate = 1;
                utterance.volume = 1;
                window.speechSynthesis.speak(utterance);
            }
            spokenSlideId.current = SLIDE_ID;
        }
    }, [activeSlideInfo.index, isPlaying, voice, activeSlideInfo.slide]);


    // --- PLAYBACK LOOP ---
    const animate = (time: number) => {
        if (!startTimeRef.current) startTimeRef.current = time;
        
        // Calculate delta since last frame isn't enough, we need absolute time ref
        // But for a simple player with pause, we accumulate time.
        // Let's use performance.now() approach
        
        const now = performance.now();
        // This logic is tricky with pauses. Simplified: 
        // We advance time by constant amount (e.g. 16ms) or use delta.
        // Let's use simple interval for MVP robustness.
    };

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
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
            }, 30); // ~30FPS update for UI
        }
        return () => clearInterval(interval);
    }, [isPlaying, totalDuration]); // Re-create timer if play state changes (resets base timestamp) Note: this logic has a flaw if you pause and resume, let's fix below.

    // Better Playback Logic
    // We actually just need the interval to add delta
    // But re-rendering causes drift.
    // The previous implementation resets `currentTime` reference on mount.
    // Fix: We rely on the `currentTime` state update.

    const togglePlay = () => {
        setIsPlaying(!isPlaying);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        setCurrentTime(time);
        spokenSlideId.current = null; // Allow re-speaking if we seek back
        window.speechSynthesis.cancel();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-full bg-gray-950">
            {/* 1. MONITOR AREA (The "Player") */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-900 relative">
                <div className="aspect-video w-full max-w-5xl bg-black shadow-2xl relative overflow-hidden group">
                    
                    {/* Visual Layer */}
                    <div 
                        className="w-full h-full relative"
                        style={{ backgroundColor: globalStyle.mainColor }}
                    >
                        {activeSlideInfo.slide ? (
                            <SlideRenderer
                                html={activeSlideInfo.slide.content_html}
                                step={100} // Show all elements for video (animation handled by SlideRenderer on mount? No, SlideRenderer animates on mount. We need to reset it?)
                                // Issue: SlideRenderer animates on MOUNT.
                                // In this timeline, the component mounts when activeSlideInfo.index changes.
                                // This is actually perfect for slide transitions!
                                key={activeSlideInfo.index} // Force re-mount on slide change to trigger animations
                                fontFamily={globalStyle.fontFamily}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                视频结束
                            </div>
                        )}
                    </div>

                    {/* Subtitle Layer (Overlay) */}
                    <div className="absolute bottom-8 left-0 w-full px-16 text-center z-20">
                         <div className="inline-block bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg">
                            <p className="text-xl md:text-2xl font-bold text-yellow-400 drop-shadow-md font-sans">
                                {activeSlideInfo.slide?.narration || "..."}
                            </p>
                         </div>
                    </div>

                    {/* Play Button Overlay (When paused) */}
                    {!isPlaying && (
                        <div 
                            className="absolute inset-0 flex items-center justify-center bg-black/20 z-30 cursor-pointer"
                            onClick={togglePlay}
                        >
                            <div className="w-20 h-20 rounded-full bg-blue-600/90 text-white flex items-center justify-center text-3xl shadow-lg hover:scale-105 transition-transform backdrop-blur">
                                <i className="fa-solid fa-play ml-2"></i>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. TIMELINE EDITOR AREA */}
            <div className="h-64 bg-[#1e1e1e] border-t border-gray-800 flex flex-col">
                {/* Toolbar */}
                <div className="h-12 border-b border-white/5 flex items-center justify-between px-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={togglePlay}
                            className="text-white hover:text-blue-400 transition-colors text-xl w-8"
                        >
                            <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                        </button>
                        <span className="text-xs font-mono text-gray-400">
                            {formatTime(currentTime)} / {formatTime(totalDuration)}
                        </span>
                    </div>
                    
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors">
                            <i className="fa-solid fa-closed-captioning"></i> 字幕配置
                        </button>
                        <button className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-xs text-white font-bold transition-colors shadow-lg shadow-blue-900/20">
                            <i className="fa-solid fa-file-export"></i> 导出 MP4
                        </button>
                    </div>
                </div>

                {/* Tracks Container */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden relative custom-scrollbar px-4 py-4 select-none">
                    
                    {/* Time Ruler (Visual Only) */}
                    <div className="h-6 flex border-b border-white/10 mb-2 relative">
                         {Array.from({ length: Math.ceil(totalDuration / 5) }).map((_, i) => (
                             <div key={i} className="absolute h-full border-l border-white/20 text-[10px] text-gray-500 pl-1" style={{ left: `${(i * 5 / totalDuration) * 100}%`}}>
                                 {formatTime(i * 5)}
                             </div>
                         ))}
                    </div>

                    {/* Playhead */}
                    <div 
                        className="absolute top-4 bottom-0 w-0.5 bg-red-500 z-50 pointer-events-none"
                        style={{ left: `calc(${ (currentTime / totalDuration) * 100 }% + 16px)` }} // 16px padding offset
                    >
                        <div className="w-3 h-3 bg-red-500 -ml-1.5 rotate-45 transform -translate-y-1.5"></div>
                    </div>

                    {/* Track 1: Visual Slides */}
                    <div className="flex h-16 mb-2 w-full bg-gray-900 rounded relative">
                        {slides.map((slide, index) => {
                            const widthPercent = (slide.duration / totalDuration) * 100;
                            const isActive = activeSlideInfo.index === index;
                            return (
                                <div 
                                    key={slide.id}
                                    className={`h-full border-r border-black/50 relative group overflow-hidden transition-colors ${isActive ? 'bg-blue-900/40' : 'bg-gray-800'}`}
                                    style={{ width: `${widthPercent}%` }}
                                    onClick={() => {
                                        // Calculate start time of this slide to seek
                                        let start = 0;
                                        for(let i=0; i<index; i++) start += slides[i].duration;
                                        setCurrentTime(start);
                                        window.speechSynthesis.cancel();
                                        spokenSlideId.current = null;
                                    }}
                                >
                                    {/* Thumbnail / Preview */}
                                    <div className="absolute inset-0 opacity-20 flex items-center justify-center text-[10px] text-gray-400 p-2 break-words leading-none pointer-events-none">
                                        {slide.title}
                                    </div>
                                    <div className="absolute bottom-1 left-1 text-[9px] text-blue-300 font-mono bg-black/50 px-1 rounded">
                                        Slide {index + 1}
                                    </div>
                                    <div className="absolute top-1 right-1 text-[9px] text-gray-400 font-mono">
                                        {slide.duration}s
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Track 2: Audio/Narration */}
                    <div className="flex h-12 w-full bg-gray-900 rounded relative">
                         {slides.map((slide, index) => {
                            const widthPercent = (slide.duration / totalDuration) * 100;
                            const isActive = activeSlideInfo.index === index;
                            return (
                                <div 
                                    key={slide.id}
                                    className={`h-full border-r border-black/50 relative p-1 overflow-hidden cursor-pointer ${isActive ? 'bg-green-900/30' : 'bg-gray-800/50'}`}
                                    style={{ width: `${widthPercent}%` }}
                                >
                                     <div className={`w-full h-full rounded border flex items-center px-2 ${isActive ? 'bg-green-600 border-green-500' : 'bg-green-800 border-green-700'}`}>
                                        <i className="fa-solid fa-wave-square text-white/50 text-xs mr-2"></i>
                                        <span className="text-[10px] text-white truncate w-full">{slide.narration}</span>
                                     </div>
                                </div>
                            );
                         })}
                    </div>
                    
                    {/* Scrubbing Interaction Layer (Invisible input) */}
                    <input 
                        type="range"
                        min={0}
                        max={totalDuration}
                        step={0.1}
                        value={currentTime}
                        onChange={handleSeek}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-40"
                    />

                </div>
            </div>
        </div>
    );
};

export default VideoStage;