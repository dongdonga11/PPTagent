import React from 'react';
import { Slide, GlobalStyle } from '../types';

interface SlidePreviewProps {
  slide: Slide | null;
  globalStyle: GlobalStyle;
}

const SlidePreview: React.FC<SlidePreviewProps> = ({ slide, globalStyle }) => {
  if (!slide) {
    return (
      <div className="h-full w-full flex items-center justify-center text-gray-500 bg-gray-900 border border-gray-800 rounded-lg">
        <div className="text-center">
            <i className="fa-solid fa-layer-group text-4xl mb-4 opacity-50"></i>
            <p>未选择幻灯片</p>
        </div>
      </div>
    );
  }

  if (slide.isLoading) {
    return (
        <div className="h-full w-full flex flex-col items-center justify-center text-accent bg-gray-900 border border-gray-800 rounded-lg animate-pulse">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl mb-4 text-[var(--accent-color)]"></i>
            <p className="text-gray-400">正在生成代码...</p>
        </div>
    );
  }

  // We wrap the content in a div that mocks the ".reveal" environment
  // The content_html contains a <section>...</section>
  return (
    <div className="h-full w-full bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
            <span className="text-xs font-mono text-gray-400 uppercase">实时预览 (Live Preview 16:9)</span>
            <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
        </div>
        
        <div 
            className="flex-1 relative overflow-hidden flex items-center justify-center bg-black p-4 sm:p-8"
            style={{
                '--main-color': globalStyle.mainColor,
                '--accent-color': globalStyle.accentColor,
            } as React.CSSProperties}
        >
            {/* 
              This container mocks the Reveal.js scale transform area. 
              We use a fixed aspect ratio box (16:9).
            */}
            <div 
                className="slide-preview-container aspect-video w-full max-w-5xl bg-black text-white relative shadow-2xl border border-gray-800 overflow-hidden"
                style={{
                    backgroundColor: '#191919', // Default Reveal Black theme bg
                    backgroundImage: `radial-gradient(circle at center, #2a2a2a 0%, #111 100%)`
                }}
            >
                {/* 
                  Dangerous HTML injection is necessary here as this is a "browser" within a browser.
                  The content comes from our AI Coder.
                  
                  CSS Tricks here:
                  1. [&>section]:h-full -> Forces the root <section> to fill the 16:9 container.
                  2. text-[16px] sm:text-[18px] md:text-[22px] -> Sets a responsive base font size so tailwind rem units scale somewhat realistically.
                  3. overflow-y-auto -> Allows scrolling IN EDIT MODE if AI generates too much, so user can fix it, even though real presentation might clip.
                */}
                <div 
                    className="w-full h-full flex items-center justify-center text-[10px] sm:text-[12px] md:text-[16px] lg:text-[20px] [&>section]:w-full [&>section]:h-full [&>section]:p-8 [&>section]:box-border [&>section]:overflow-y-auto [&>section]:no-scrollbar"
                    dangerouslySetInnerHTML={{ __html: slide.content_html || '<section><h1>空白幻灯片</h1></section>' }} 
                />
            </div>
        </div>
    </div>
  );
};

export default SlidePreview;