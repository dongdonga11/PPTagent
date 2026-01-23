import React, { useState } from 'react';
import { generateAiImage } from '../services/geminiService';

interface AssetLibraryProps {
    onInsert: (url: string, alt: string) => void;
    onClose: () => void;
}

// Simulated "Public" folder assets
const MOCK_LOCAL_ASSETS = [
    { id: 'l1', url: 'https://images.unsplash.com/photo-1531297461136-82ae96c5b0a4?auto=format&fit=crop&w=500&q=60', tag: 'Tech' },
    { id: 'l2', url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=500&q=60', tag: 'Office' },
    { id: 'l3', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=500&q=60', tag: 'Team' },
    { id: 'l4', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=500&q=60', tag: 'Cyber' },
];

const AssetLibrary: React.FC<AssetLibraryProps> = ({ onInsert, onClose }) => {
    const [activeTab, setActiveTab] = useState<'local' | 'ai'>('local');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);

    const handleGenerate = async () => {
        if (!aiPrompt.trim()) return;
        setIsGenerating(true);
        try {
            const base64Image = await generateAiImage(aiPrompt);
            if (base64Image) {
                setGeneratedImages(prev => [base64Image, ...prev]);
            } else {
                alert("Generation failed. Please try a different prompt.");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-[#1a1a1a] border-l border-gray-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800 bg-[#111]">
                <h3 className="text-sm font-bold text-gray-200">素材库 (Assets)</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
                <button 
                    onClick={() => setActiveTab('local')}
                    className={`flex-1 py-3 text-xs font-bold ${activeTab === 'local' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <i className="fa-regular fa-folder-open mr-2"></i>本地 (Public)
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 py-3 text-xs font-bold ${activeTab === 'ai' ? 'text-purple-400 border-b-2 border-purple-400' : 'text-gray-500 hover:text-gray-300'}`}
                >
                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>AI 绘图
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {activeTab === 'local' ? (
                    <div className="grid grid-cols-2 gap-3">
                        {MOCK_LOCAL_ASSETS.map((asset) => (
                            <div 
                                key={asset.id} 
                                className="relative group cursor-pointer aspect-square rounded overflow-hidden border border-gray-800"
                                onClick={() => onInsert(asset.url, asset.tag)}
                            >
                                <img src={asset.url} alt={asset.tag} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                                <span className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1 rounded">{asset.tag}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="bg-[#222] p-3 rounded border border-gray-700">
                            <label className="text-xs text-purple-400 font-bold mb-2 block">AI 生图 Prompt</label>
                            <textarea 
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="描述画面，例如：未来教室..."
                                className="w-full bg-[#111] text-gray-300 text-xs p-2 rounded border border-gray-600 focus:outline-none min-h-[80px]"
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating || !aiPrompt}
                                className="w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-2"
                            >
                                {isGenerating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-palette"></i>}
                                开始生成
                            </button>
                        </div>

                        {generatedImages.length > 0 && (
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                {generatedImages.map((url, idx) => (
                                    <div 
                                        key={idx} 
                                        className="relative group cursor-pointer aspect-square rounded overflow-hidden border border-purple-500/30"
                                        onClick={() => onInsert(url, 'AI Generated')}
                                    >
                                        <img src={url} alt="AI" className="w-full h-full object-cover" />
                                        <div className="absolute top-1 right-1 bg-purple-600 text-white text-[9px] px-1.5 rounded-full">AI</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetLibrary;
