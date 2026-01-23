
import React from 'react';
import { AppMode } from '../types';

interface StageSidebarProps {
    currentMode: AppMode;
    onSetMode: (mode: AppMode) => void;
}

const StageSidebar: React.FC<StageSidebarProps> = ({ currentMode, onSetMode }) => {
    
    // Grouped Navigation
    const navItems = [
        { type: 'hub', id: AppMode.HOME, icon: 'fa-solid fa-layer-group', label: '媒体库' },
        { type: 'sep' },
        // Independent Research Module
        { type: 'tool', id: AppMode.RESEARCH, icon: 'fa-solid fa-fire', label: '热点' },
        // Renamed Writer to Article
        { type: 'tool', id: AppMode.ARTICLE, icon: 'fa-solid fa-pen-nib', label: '文章' },
        { type: 'tool', id: AppMode.PRESENTATION, icon: 'fa-solid fa-person-chalkboard', label: '演示' },
        { type: 'tool', id: AppMode.VIDEO, icon: 'fa-solid fa-video', label: '视频' },
        { type: 'tool', id: AppMode.POSTER, icon: 'fa-solid fa-image', label: '海报' },
    ];

    return (
        <div className="w-16 h-full bg-[#050505] border-r border-gray-800 flex flex-col items-center py-4 z-50 shadow-2xl relative">
            {/* Branding Icon (Click to go Home) */}
            <div 
                className="mb-6 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-lg shadow-lg cursor-pointer hover:scale-105 transition-transform"
                onClick={() => onSetMode(AppMode.HOME)}
            >
                <i className="fa-solid fa-infinity"></i>
            </div>
            
            <div className="flex flex-col gap-3 w-full px-2">
                {navItems.map((item, idx) => {
                    if (item.type === 'sep') {
                        return <div key={idx} className="h-[1px] bg-gray-800 w-8 mx-auto my-2"></div>;
                    }

                    const isActive = currentMode === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onSetMode(item.id as AppMode)}
                            className={`group relative flex flex-col items-center justify-center w-full h-12 rounded-xl transition-all duration-300
                                ${isActive 
                                    ? 'bg-[#1a1a1a] text-white shadow-inner ring-1 ring-gray-700' 
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'}
                            `}
                            title={item.label}
                        >
                            {/* Active Indicator Bar */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r-full"></div>
                            )}
                            
                            <div className={`text-xl mb-0.5 transition-transform group-hover:scale-110 ${isActive ? 'scale-110 text-indigo-400' : ''}`}>
                                <i className={item.icon}></i>
                            </div>
                            <span className="text-[9px] font-medium opacity-80 scale-90">{item.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Bottom Actions */}
            <div className="mt-auto flex flex-col gap-4 pb-2">
                 <button className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors">
                    <i className="fa-solid fa-gear"></i>
                 </button>
            </div>
        </div>
    );
};
export default StageSidebar;
