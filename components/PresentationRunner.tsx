
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { Slide, GlobalStyle } from '../types';

interface PresentationRunnerProps {
    slides: Slide[];
    globalStyle: GlobalStyle;
    onClose: () => void;
}

// Exporting this for reuse in VideoStage and SlidePreview
export const SlideRenderer: React.FC<{ 
    html: string; 
    step: number; 
    fontFamily: string;
    className?: string;
    baseWidth?: number;  // Default 1280 (720p 16:9)
    baseHeight?: number; // Default 720
}> = ({ html, step, fontFamily, className, baseWidth = 1280, baseHeight = 720 }) => {
    const [scope, animate] = useAnimate();
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    // --- SCALING LOGIC ---
    useEffect(() => {
        const updateScale = () => {
            if (containerRef.current && containerRef.current.parentElement) {
                const parent = containerRef.current.parentElement;
                const { width, height } = parent.getBoundingClientRect();
                
                // Avoid division by zero or hidden elements
                if (width === 0 || height === 0) return;

                // Calculate "contain" scale factor
                const scaleX = width / baseWidth;
                const scaleY = height / baseHeight;
                const newScale = Math.min(scaleX, scaleY);
                
                setScale(newScale);
            }
        };

        // Initial calculation
        updateScale();
        
        // Observe parent resize
        const resizeObserver = new ResizeObserver(updateScale);
        if (containerRef.current?.parentElement) {
            resizeObserver.observe(containerRef.current.parentElement);
        }
        
        return () => resizeObserver.disconnect();
    }, [baseWidth, baseHeight]);

    // --- ANIMATION LOGIC ---
    const cssHide = `
        .slide-runner-content [data-motion] {
            opacity: 0;
        }
    `;

    useEffect(() => {
        if (!scope.current) return;

        const elements = scope.current.querySelectorAll('[data-motion]');
        
        elements.forEach((el: HTMLElement, index: number) => {
            const shouldBeVisible = index < step;
            const motionType = el.dataset.motion;
            
            let hiddenState: any = { opacity: 0 };
            if (motionType === 'fade-up') hiddenState = { opacity: 0, y: 30, scale: 1, x: 0 };
            else if (motionType === 'slide-right') hiddenState = { opacity: 0, x: -30, y: 0, scale: 1 };
            else if (motionType === 'zoom-in') hiddenState = { opacity: 0, scale: 0.8, y: 0, x: 0 };
            else hiddenState = { opacity: 0, x: 0, y: 0, scale: 1 };

            const visibleState = { opacity: 1, y: 0, x: 0, scale: 1 };

            if (shouldBeVisible) {
                animate(el, visibleState, { duration: 0.5, ease: "easeOut" });
            } else {
                animate(el, hiddenState, { duration: 0.3, ease: "easeOut" });
            }
        });
    }, [step, html, animate, scope]);

    return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <style>{cssHide}</style>
            <div 
                ref={containerRef}
                style={{
                    width: `${baseWidth}px`,
                    height: `${baseHeight}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    fontFamily: fontFamily
                }}
                className="flex-shrink-0 relative bg-transparent shadow-sm"
            >
                <div 
                    ref={scope}
                    className={`w-full h-full p-12 flex flex-col slide-content-wrapper slide-runner-content ${className || ''}`}
                    dangerouslySetInnerHTML={{ __html: html }}
                />
            </div>
        </div>
    );
};

const PresentationRunner: React.FC<PresentationRunnerProps> = ({ slides, globalStyle, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [animationStep, setAnimationStep] = useState(0);

    const currentSlide = slides[currentIndex];

    const totalSteps = useMemo(() => {
        if (!currentSlide?.content_html) return 0;
        const matches = currentSlide.content_html.match(/data-motion/g);
        return matches ? matches.length : 0;
    }, [currentSlide]);

    useEffect(() => {
        setAnimationStep(0);
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        if (animationStep < totalSteps) {
            setAnimationStep(prev => prev + 1);
        } else if (currentIndex < slides.length - 1) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, slides.length, animationStep, totalSteps]);

    const handlePrev = useCallback(() => {
        if (animationStep > 0) {
            setAnimationStep(prev => prev - 1);
        } else if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex, animationStep]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext, handlePrev, onClose]);

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? '100%' : '-100%',
            opacity: 0,
        })
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
            style={{ backgroundColor: globalStyle.mainColor }}
        >
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50 bg-black/20 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="text-white/50 text-sm font-mono">
                    {currentIndex + 1} / {slides.length} <span className="mx-2">|</span> Step: {animationStep}/{totalSteps}
                </div>
                <button onClick={onClose} className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                    退出播放
                </button>
            </div>

            <div className="relative w-full h-full max-w-[1920px] aspect-video flex items-center justify-center p-4 sm:p-12">
                <AnimatePresence initial={false} custom={direction} mode='popLayout'>
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 260, damping: 25 }}
                        className="absolute w-full h-full flex flex-col items-center justify-center shadow-2xl rounded-xl overflow-hidden bg-black/10"
                        style={{ fontFamily: globalStyle.fontFamily }}
                    >
                        <SlideRenderer 
                            html={currentSlide?.content_html || '<div></div>'} 
                            step={animationStep}
                            fontFamily={globalStyle.fontFamily}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            <div className="absolute left-0 top-0 w-[10%] h-full cursor-pointer z-40 hover:bg-white/5 transition-colors" onClick={handlePrev} />
            <div className="absolute right-0 top-0 w-[10%] h-full cursor-pointer z-40 hover:bg-white/5 transition-colors" onClick={handleNext} />
        </div>
    );
};

export default PresentationRunner;
