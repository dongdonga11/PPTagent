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

  return (
    <div className="h-full w-full bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="bg-gray-800 px-4 py-2 flex justify-between items-center border-b border-gray-700">
            <span className="text-xs font-mono text-gray-400 uppercase">React Motion Preview</span>
            <div className="flex gap-2">
                 <div className="w-3 h-3 rounded-full bg-red-500"></div>
                 <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                 <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
        </div>
        
        <div 
            className="flex-1 relative overflow-hidden flex items-center justify-center p-4 sm:p-8"
            style={{
                backgroundColor: globalStyle.mainColor, // Use theme background for container
                backgroundImage: `radial-gradient(circle at center, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.1) 100%)`
            }}
        >
            {/* 
              Aspect Ratio Container (16:9)
            */}
            <div 
                className="slide-preview-container aspect-video w-full max-w-5xl bg-transparent relative shadow-2xl border border-white/10 overflow-hidden"
                style={{
                    fontFamily: globalStyle.fontFamily
                }}
            >
                {/* 
                  Scale text based on viewport width for preview.
                  We use a div instead of section. 
                  overflow-y-auto allows editing overflow content.
                */}
                <div 
                    className="w-full h-full flex flex-col text-[10px] sm:text-[12px] md:text-[16px] lg:text-[20px] p-8 overflow-y-auto"
                    style={{ color: '#fff' }} /* Default text color, overridden by tailwind in html */
                    dangerouslySetInnerHTML={{ __html: slide.content_html || '<div class="flex items-center justify-center h-full"><h1>空白幻灯片</h1></div>' }} 
                />
            </div>
        </div>
    </div>
  );
};

export default SlidePreview;