import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { Slide, GlobalStyle } from '../types';

interface PresentationRunnerProps {
    slides: Slide[];
    globalStyle: GlobalStyle;
    onClose: () => void;
}

// Sub-component to handle individual slide animations
// This ensures each slide has its own animation scope/ref, preventing conflicts during transitions
const SlideRenderer: React.FC<{ 
    html: string; 
    step: number; 
    fontFamily: string 
}> = ({ html, step, fontFamily }) => {
    const [scope, animate] = useAnimate();

    // Initial style injection to prevent flash (hide all motion elements)
    // We do this via a style tag scoped to this component instance effectively
    const cssHide = `
        .slide-runner-content [data-motion] {
            opacity: 0;
        }
    `;

    useEffect(() => {
        if (!scope.current) return;

        const elements = scope.current.querySelectorAll('[data-motion]');
        
        elements.forEach((el: HTMLElement, index: number) => {
            // Logic: elements with index < step are visible
            const shouldBeVisible = index < step;
            const motionType = el.dataset.motion;
            
            // Define Hidden States
            let hiddenState: any = { opacity: 0 };
            if (motionType === 'fade-up') hiddenState = { opacity: 0, y: 30, scale: 1, x: 0 };
            else if (motionType === 'slide-right') hiddenState = { opacity: 0, x: -30, y: 0, scale: 1 };
            else if (motionType === 'zoom-in') hiddenState = { opacity: 0, scale: 0.8, y: 0, x: 0 };
            else hiddenState = { opacity: 0, x: 0, y: 0, scale: 1 };

            const visibleState = { opacity: 1, y: 0, x: 0, scale: 1 };

            if (shouldBeVisible) {
                animate(el, visibleState, { duration: 0.5, ease: "easeOut" });
            } else {
                // When stepping back or initializing
                animate(el, hiddenState, { duration: 0.3, ease: "easeOut" });
            }
        });
    }, [step, html, animate, scope]);

    return (
        <>
            <style>{cssHide}</style>
            <div 
                ref={scope}
                className="w-full h-full p-8 sm:p-16 flex flex-col slide-content-wrapper slide-runner-content"
                dangerouslySetInnerHTML={{ __html: html }}
                style={{ fontFamily }}
            />
        </>
    );
};

const PresentationRunner: React.FC<PresentationRunnerProps> = ({ slides, globalStyle, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0);
    const [animationStep, setAnimationStep] = useState(0);

    const currentSlide = slides[currentIndex];

    // Calculate total animation steps for the current slide based on HTML string
    // This avoids needing to query the DOM and solves the "ref" dependency issue for logic
    const totalSteps = useMemo(() => {
        if (!currentSlide?.content_html) return 0;
        const matches = currentSlide.content_html.match(/data-motion/g);
        return matches ? matches.length : 0;
    }, [currentSlide]);

    // Reset step when slide changes
    useEffect(() => {
        // When entering a new slide, we can choose to auto-play the first element (Title)
        // or start completely blank.
        // Let's start with 1 step visible (Title usually) to avoid a blank screen, 
        // unless totalSteps is 0.
        // If the user wants full manual control, set to 0. 
        // Based on user feedback "flash then disappear", 0 is safer but we need to ensure they know to click.
        // Let's stick to 0 (all hidden) but ensure the transition is smooth.
        setAnimationStep(0);
    }, [currentIndex]);

    const handleNext = useCallback(() => {
        // If there are more steps to reveal on this slide
        if (animationStep < totalSteps) {
            setAnimationStep(prev => prev + 1);
        } 
        // Else go to next slide
        else if (currentIndex < slides.length - 1) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, slides.length, animationStep, totalSteps]);

    const handlePrev = useCallback(() => {
        if (animationStep > 0) {
            setAnimationStep(prev => prev - 1);
        }
        else if (currentIndex > 0) {
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

    // Slide Transition Variants
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
                        {/* 
                            We pass the current animation step to the child renderer.
                            The child renderer manages its own scope, solving the ref conflict.
                        */}
                        <SlideRenderer 
                            html={currentSlide?.content_html || '<div></div>'} 
                            step={animationStep}
                            fontFamily={globalStyle.fontFamily}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Click Zones */}
            <div className="absolute left-0 top-0 w-[10%] h-full cursor-pointer z-40 hover:bg-white/5 transition-colors" onClick={handlePrev} />
            <div className="absolute right-0 top-0 w-[10%] h-full cursor-pointer z-40 hover:bg-white/5 transition-colors" onClick={handleNext} />
        </div>
    );
};

export default PresentationRunner;