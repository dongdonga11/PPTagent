import React, { useState, useEffect } from 'react';
import { Slide } from '../types';

interface ScriptEditorProps {
    slide: Slide;
    onSave: (id: string, narration: string, duration: number) => void;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({ slide, onSave }) => {
    const [narration, setNarration] = useState(slide.narration || '');
    const [duration, setDuration] = useState(slide.duration || 5);

    useEffect(() => {
        setNarration(slide.narration || '');
        setDuration(slide.duration || 5);
    }, [slide.id, slide.narration, slide.duration]);

    const handleSave = () => {
        onSave(slide.id, narration, duration);
    };

    return (
        <div className="flex flex-col h-full bg-gray-900 border-t border-gray-800">
            <div className="px-4 py-2 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500 uppercase">脚本 & 旁白</span>
                    <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-300 text-[10px] rounded border border-purple-800">Video</span>
                 </div>
                 <button 
                    className="text-xs text-blue-400 hover:text-blue-300 uppercase font-bold"
                    onClick={handleSave}
                 >
                    保存脚本
                 </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                {/* Duration Control */}
                <div className="bg-black/20 p-3 rounded border border-gray-800">
                    <label className="text-xs text-gray-500 mb-1 block">预估时长 (秒)</label>
                    <div className="flex items-center gap-2">
                        <input 
                            type="number" 
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            className="bg-gray-800 text-white text-sm px-2 py-1 rounded w-20 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-600">
                            (基于语速约 {Math.round(narration.length / (duration/60) || 0)} 字/分钟)
                        </span>
                    </div>
                </div>

                {/* Narration Text */}
                <div className="flex-1 flex flex-col">
                    <label className="text-xs text-gray-500 mb-2 block">旁白逐字稿 (用于 TTS 生成)</label>
                    <textarea
                        className="flex-1 bg-[#0d1117] text-gray-300 text-sm p-4 focus:outline-none resize-none rounded border border-gray-800 leading-relaxed"
                        value={narration}
                        onChange={(e) => setNarration(e.target.value)}
                        onBlur={handleSave}
                        placeholder="在此输入视频旁白..."
                    />
                </div>
            </div>
        </div>
    );
}

export default ScriptEditor;