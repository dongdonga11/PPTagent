
import React from 'react';
import { ProjectStage } from '../types';

interface StageSidebarProps {
    currentStage: ProjectStage;
    onSetStage: (stage: ProjectStage) => void;
    onOpenSettings: () => void; // NEW PROP
}

const StageSidebar: React.FC<StageSidebarProps> = ({ currentStage, onSetStage, onOpenSettings }) => {
    
    // Grouped Navigation
    const navItems = [
        { type: 'hub', id: ProjectStage.DASHBOARD, icon: 'fa-solid fa-house-chimney', label: '主控' },
        { type: 'sep' },
        { type: 'tool', id: ProjectStage.RESEARCH, icon: 'fa-solid fa-satellite-dish', label: '情报' },
        { type: 'tool', id: ProjectStage.STORY, icon: 'fa-solid fa-pen-nib', label: '文案' },
        { type: 'tool', id: ProjectStage.POSTER, icon: 'fa-solid fa-image-portrait', label: '海报' },
        { type: 'tool', id: ProjectStage.SCRIPT, icon: 'fa-solid fa-clapperboard', label: '脚本' },
        { type: 'tool', id: ProjectStage.VISUAL, icon: 'fa-solid fa-palette', label: '视觉' },
        { type: 'tool', id: ProjectStage.EXPORT, icon: 'fa-solid fa-film', label: '合成' },
    ];

    return (
        <div className="w-16 h-full bg-[#050505] border-r border-gray-800 flex flex-col items-center py-4 z-20 shadow-2xl">
            {/* Branding Icon (Click to go Home) */}
            <div 
                className="mb-6 w-10 h-10 rounded-xl bg-gradient-to-br from-green-600 to-emerald-400 flex items-center justify-center text-white text-lg shadow-lg cursor-pointer hover:scale-105 transition-transform"
                onClick={() => onSetStage(ProjectStage.DASHBOARD)}
            >
                <i className="fa-brands fa-weixin"></i>
            </div>
            
            <div className="flex flex-col gap-2 w-full px-2">
                {navItems.map((item, idx) => {
                    if (item.type === 'sep') {
                        return <div key={idx} className="h-[1px] bg-gray-800 w-8 mx-auto my-2"></div>;
                    }

                    const isActive = currentStage === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onSetStage(item.id as ProjectStage)}
                            className={`group relative flex flex-col items-center justify-center w-full h-12 rounded-lg transition-all
                                ${isActive 
                                    ? 'bg-[#1a1a1a] text-blue-400' 
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'}
                            `}
                            title={item.label}
                        >
                            {/* Active Indicator Dot */}
                            {isActive && (
                                <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-1 bg-blue-500 rounded-full"></div>
                            )}
                            
                            <div className={`text-base mb-0.5 transition-transform group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
                                <i className={item.icon}></i>
                            </div>
                            <span className="text-[9px] font-medium opacity-80 scale-90">{item.label}</span>
                        </button>
                    )
                })}
            </div>

            {/* Bottom Actions */}
            <div className="mt-auto flex flex-col gap-4 pb-2">
                 <button 
                    onClick={onOpenSettings}
                    className="w-8 h-8 rounded-full bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 flex items-center justify-center text-xs transition-colors shadow-lg border border-gray-700"
                    title="全局设置"
                 >
                    <i className="fa-solid fa-gear"></i>
                 </button>
            </div>
        </div>
    );
};
export default StageSidebar;
