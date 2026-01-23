
import React, { useState } from 'react';
import { Slide } from '../types';
import ScriptStoryboard from './ScriptStoryboard';
import ScriptTableView from './ScriptTableView';

interface ScriptEngineProps {
    slides: Slide[];
    activeSlideId: string | null;
    onSelect: (id: string) => void;
    onUpdateSlide: (id: string, updates: Partial<Slide>) => void;
    globalStyle: any;
    onGenerateVisual: (id: string) => void;
}

const ScriptEngine: React.FC<ScriptEngineProps> = (props) => {
    const [viewMode, setViewMode] = useState<'table' | 'storyboard'>('table');

    // Helper to switch to storyboard and select a slide
    const handleSwitchToStoryboard = (slideId: string) => {
        props.onSelect(slideId);
        setViewMode('storyboard');
    };

    return (
        <div className="flex flex-col h-full bg-[#0F0F12]">
            {/* Top Toolbar / View Switcher */}
            <div className="h-12 border-b border-gray-800 flex items-center justify-between px-6 bg-[#141414] shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                        <i className="fa-solid fa-clapperboard text-green-500"></i>
                        Script Engine
                    </h2>
                    <div className="h-4 w-[1px] bg-gray-700"></div>
                    <div className="flex bg-gray-900 rounded p-0.5 border border-gray-800">
                        <button 
                            onClick={() => setViewMode('table')}
                            className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'table' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <i className="fa-solid fa-table"></i> 列表视图 (List)
                        </button>
                        <button 
                            onClick={() => setViewMode('storyboard')}
                            className={`px-3 py-1 rounded text-xs font-bold flex items-center gap-2 transition-all ${viewMode === 'storyboard' ? 'bg-gray-700 text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <i className="fa-solid fa-layer-group"></i> 故事板 (Board)
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-gray-500">
                        {props.slides.filter(s => s.isGenerated).length}/{props.slides.length} Ready
                    </span>
                    <button className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded font-bold transition-colors shadow-lg">
                        <i className="fa-solid fa-bolt mr-1"></i> 一键生成所有画面
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {viewMode === 'table' ? (
                    <ScriptTableView 
                        {...props} 
                        onSelectSlide={handleSwitchToStoryboard}
                    />
                ) : (
                    <ScriptStoryboard {...props} />
                )}
            </div>
        </div>
    );
};

export default ScriptEngine;
