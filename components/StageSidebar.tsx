import React from 'react';
import { ProjectStage } from '../types';

interface StageSidebarProps {
    currentStage: ProjectStage;
    onSetStage: (stage: ProjectStage) => void;
}

const StageSidebar: React.FC<StageSidebarProps> = ({ currentStage, onSetStage }) => {
    
    const steps = [
        { id: ProjectStage.STORY, icon: 'fa-solid fa-pen-nib', label: '文案' },
        { id: ProjectStage.SCRIPT, icon: 'fa-solid fa-clapperboard', label: '脚本' },
        { id: ProjectStage.VISUAL, icon: 'fa-solid fa-palette', label: '视觉' },
        { id: ProjectStage.EXPORT, icon: 'fa-solid fa-film', label: '合成' },
    ];

    return (
        <div className="w-16 h-full bg-gray-950 border-r border-gray-800 flex flex-col items-center py-4 z-20">
            <div className="mb-6 text-blue-500 text-xl">
                <i className="fa-brands fa-space-awesome"></i>
            </div>
            
            <div className="flex flex-col gap-6 w-full">
                {steps.map((step, index) => {
                    const isActive = currentStage === step.id;
                    return (
                        <button
                            key={step.id}
                            onClick={() => onSetStage(step.id)}
                            className={`group relative flex flex-col items-center justify-center w-full h-14 transition-all
                                ${isActive ? 'text-blue-400' : 'text-gray-600 hover:text-gray-300'}
                            `}
                        >
                            {/* Active Indicator Line */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                            )}

                            <div className={`text-xl mb-1 transition-transform group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
                                <i className={step.icon}></i>
                            </div>
                            <span className="text-[10px] font-medium">{step.label}</span>
                        </button>
                    )
                })}
            </div>

            <div className="mt-auto flex flex-col gap-4">
                 <button className="text-gray-600 hover:text-white transition-colors">
                    <i className="fa-solid fa-gear"></i>
                 </button>
            </div>
        </div>
    );
};

export default StageSidebar;