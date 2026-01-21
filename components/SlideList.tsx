import React from 'react';
import { Slide } from '../types';

interface SlideListProps {
  slides: Slide[];
  activeId: string;
  onSelect: (id: string) => void;
}

const SlideList: React.FC<SlideListProps> = ({ slides, activeId, onSelect }) => {
  return (
    <div className="h-full bg-gray-950 border-r border-gray-800 flex flex-col w-64">
        <div className="p-4 border-b border-gray-800">
             <h2 className="text-xs font-bold tracking-wider uppercase text-gray-400">幻灯片 (Slides) {slides.length > 0 && `(${slides.length})`}</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
            {slides.map((slide, index) => (
                <button
                    key={slide.id}
                    onClick={() => onSelect(slide.id)}
                    className={`w-full text-left p-3 border-b border-gray-900 hover:bg-gray-900 transition-colors flex gap-3 group ${
                        activeId === slide.id ? 'bg-gray-900 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'
                    }`}
                >
                    <div className="text-gray-500 font-mono text-xs pt-1">{index + 1}</div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`text-sm truncate font-medium ${activeId === slide.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                            {slide.title}
                        </h3>
                        <p className="text-xs text-gray-600 truncate">{slide.visual_intent}</p>
                    </div>
                     {slide.isLoading && (
                        <i className="fa-solid fa-spinner fa-spin text-blue-500 pt-1"></i>
                     )}
                     {!slide.isGenerated && !slide.isLoading && (
                         <i className="fa-regular fa-circle text-gray-700 pt-1" title="等待生成"></i>
                     )}
                     {slide.isGenerated && !slide.isLoading && (
                         <i className="fa-solid fa-check text-green-900 pt-1"></i>
                     )}
                </button>
            ))}
        </div>
    </div>
  );
};

export default SlideList;