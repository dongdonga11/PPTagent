import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slide, GlobalStyle } from '../types';

interface PresentationRunnerProps {
    slides: Slide[];
    globalStyle: GlobalStyle;
    onClose: () => void;
}

const PresentationRunner: React.FC<PresentationRunnerProps> = ({ slides, globalStyle, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [direction, setDirection] = useState(0); // -1 for left, 1 for right

    const handleNext = useCallback(() => {
        if (currentIndex < slides.length - 1) {
            setDirection(1);
            setCurrentIndex(prev => prev + 1);
        }
    }, [currentIndex, slides.length]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setDirection(-1);
            setCurrentIndex(prev => prev - 1);
        }
    }, [currentIndex]);

    // Keyboard navigation
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

    const currentSlide = slides[currentIndex];

    // Variants for slide animation
    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            zIndex: 0,
            x: direction < 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.95
        })
    };

    return (
        <div 
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden"
            style={{ backgroundColor: globalStyle.mainColor }}
        >
            {/* Header / Controls */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50 bg-black/20 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity duration-300">
                <div className="text-white/50 text-sm font-mono">
                    {currentIndex + 1} / {slides.length}
                </div>
                <button 
                    onClick={onClose}
                    className="bg-red-500/80 hover:bg-red-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg transition-transform hover:scale-105"
                >
                    退出播放
                </button>
            </div>

            {/* Slide Container */}
            <div className="relative w-full h-full max-w-[1920px] aspect-video flex items-center justify-center p-4 sm:p-12">
                <AnimatePresence initial={false} custom={direction} mode='wait'>
                    <motion.div
                        key={currentIndex}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            x: { type: "spring", stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 }
                        }}
                        className="absolute w-full h-full flex flex-col items-center justify-center shadow-2xl rounded-xl overflow-hidden bg-black/10"
                        style={{ fontFamily: globalStyle.fontFamily }}
                    >
                        {/* Inject HTML Content */}
                        <div 
                            className="w-full h-full p-8 sm:p-16 flex flex-col slide-content-wrapper"
                            dangerouslySetInnerHTML={{ __html: currentSlide?.content_html || '<div></div>' }}
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Areas (Clickable sides) */}
            <div 
                className="absolute left-0 top-0 w-[10%] h-full cursor-pointer z-40 hover:bg-white/5 transition-colors"
                onClick={handlePrev} 
            />
            <div 
                className="absolute right-0 top-0 w-[10%] h-full cursor-pointer z-40 hover:bg-white/5 transition-colors"
                onClick={handleNext}
            />
        </div>
    );
};

export default PresentationRunner;