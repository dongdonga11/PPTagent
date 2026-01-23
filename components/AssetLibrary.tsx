
import React, { useState, useRef } from 'react';
import { generateAiImage } from '../services/geminiService';

interface AssetLibraryProps {
    onInsert: (url: string, alt: string, type: 'image' | 'video') => void;
    onClose: () => void;
}

// Simulated "Public" folder assets
const INITIAL_ASSETS = [
    { id: 'l1', url: 'https://images.unsplash.com/photo-1531297461136-82ae96c5b0a4?auto=format&fit=crop&w=600&q=80', tag: 'Tech', type: 'image' },
    { id: 'l2', url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=600&q=80', tag: 'Office', type: 'image' },
    { id: 'l3', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80', tag: 'Team', type: 'image' },
    { id: 'l4', url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=600&q=80', tag: 'Cyber', type: 'image' },
    { id: 'l5', url: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=600&q=80', tag: 'Work', type: 'image' },
    { id: 'l6', url: 'https://images.unsplash.com/photo-1664575602554-2087b04935a5?auto=format&fit=crop&w=600&q=80', tag: 'Woman', type: 'image' },
];

const AssetLibrary: React.FC<AssetLibraryProps> = ({ onInsert, onClose }) => {
    const [activeTab, setActiveTab] = useState<'local' | 'ai'>('local');
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [localAssets, setLocalAssets] = useState(INITIAL_ASSETS);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file: File) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) {
                    const type = file.type.startsWith('video') ? 'video' : 'image';
                    setLocalAssets(prev => [{
                        id: `upload-${Date.now()}-${Math.random()}`,
                        url: event.target!.result as string,
                        tag: 'Upload',
                        type: type as 'image' | 'video'
                    }, ...prev]);
                }
            };
            reader.readAsDataURL(file);
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Allow dragging images into Tiptap
    const handleDragStart = (e: React.DragEvent, url: string, type: 'image' | 'video') => {
        // Tiptap drop handling is generic, but we can pass HTML
        if (type === 'image') {
            const html = `<img src="${url}" alt="Dropped Image" />`;
            e.dataTransfer.setData('text/html', html);
        } else {
            const html = `<video src="${url}" controls></video>`;
            e.dataTransfer.setData('text/html', html);
        }
        e.dataTransfer.setData('text/plain', url);
    };

    return (
        <div className="fixed inset-y-0 right-0 w-80 bg-[#141414] border-l border-gray-800 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 animate-in slide-in-from-right">
            {/* Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-800 bg-[#1a1a1a] shrink-0">
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-photo-film text-blue-500"></i>
                    <h3 className="text-sm font-bold text-gray-200">素材库 (Assets)</h3>
                </div>
                <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 bg-[#111] shrink-0">
                <button 
                    onClick={() => setActiveTab('local')}
                    className={`flex-1 py-3 text-xs font-bold transition-all border-b-2
                        ${activeTab === 'local' ? 'text-blue-400 border-blue-400 bg-blue-900/10' : 'text-gray-500 border-transparent hover:text-gray-300'}
                    `}
                >
                    <i className="fa-regular fa-images mr-2"></i>本地素材
                </button>
                <button 
                    onClick={() => setActiveTab('ai')}
                    className={`flex-1 py-3 text-xs font-bold transition-all border-b-2
                        ${activeTab === 'ai' ? 'text-purple-400 border-purple-400 bg-purple-900/10' : 'text-gray-500 border-transparent hover:text-gray-300'}
                    `}
                >
                    <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>AI 绘图
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#111]">
                
                {/* --- LOCAL ASSETS --- */}
                {activeTab === 'local' && (
                    <div className="space-y-4">
                        {/* Upload Area */}
                        <div 
                            className="border border-dashed border-gray-700 bg-gray-800/50 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 hover:bg-gray-800 transition-all group"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*,video/*,.gif" 
                                multiple 
                                onChange={handleFileUpload}
                            />
                            <i className="fa-solid fa-cloud-arrow-up text-2xl text-gray-500 group-hover:text-blue-400 mb-2"></i>
                            <p className="text-xs text-gray-400">点击上传图片/视频</p>
                            <p className="text-[9px] text-gray-600 mt-1">支持 JPG, PNG, GIF, MP4</p>
                        </div>

                        <div className="text-[10px] text-gray-500 uppercase font-bold flex justify-between">
                             <span>Library ({localAssets.length})</span>
                             <span className="text-gray-600">Drag or Click</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {localAssets.map((asset) => (
                                <div 
                                    key={asset.id} 
                                    className="relative group cursor-grab active:cursor-grabbing aspect-video rounded-lg overflow-hidden border border-gray-800 hover:border-blue-500 transition-all shadow-sm hover:shadow-lg hover:scale-[1.02]"
                                    onClick={() => onInsert(asset.url, asset.tag, asset.type as 'image' | 'video')}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, asset.url, asset.type as 'image' | 'video')}
                                >
                                    {asset.type === 'video' ? (
                                        <video src={asset.url} className="w-full h-full object-cover" muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
                                    ) : (
                                        <img src={asset.url} alt={asset.tag} className="w-full h-full object-cover" />
                                    )}
                                    
                                    {/* Type Badge */}
                                    {asset.type === 'video' && (
                                        <div className="absolute top-1 right-1 bg-black/60 text-white text-[8px] px-1.5 rounded">VID</div>
                                    )}

                                    {/* Hover Overlay */}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <i className="fa-solid fa-plus text-white text-lg"></i>
                                    </div>
                                    <span className="absolute bottom-1 left-1 text-[9px] bg-black/80 backdrop-blur text-gray-200 px-1.5 py-0.5 rounded border border-white/10">
                                        {asset.tag}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* --- AI GENERATION --- */}
                {activeTab === 'ai' && (
                    <div className="flex flex-col gap-4 h-full">
                         <div className="bg-gradient-to-br from-[#1e1e1e] to-[#141414] p-4 rounded-xl border border-gray-800 shadow-lg">
                            <label className="text-xs text-purple-400 font-bold mb-2 block flex items-center gap-2">
                                <i className="fa-solid fa-robot"></i> 描述画面 (Prompt)
                            </label>
                            <textarea 
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="例如：一张赛博朋克风格的办公室，霓虹灯光，未来感..."
                                className="w-full bg-black/50 text-gray-200 text-xs p-3 rounded-lg border border-gray-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 min-h-[100px] mb-3 resize-none"
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating || !aiPrompt}
                                className={`w-full text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all
                                    ${isGenerating || !aiPrompt
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg hover:shadow-purple-500/20'}
                                `}
                            >
                                {isGenerating ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-palette"></i>}
                                {isGenerating ? '正在绘制...' : '开始生成 (Generate)'}
                            </button>
                        </div>

                        <div className="flex-1">
                            <h4 className="text-[10px] text-gray-500 uppercase font-bold mb-3">生成记录 (History)</h4>
                            {generatedImages.length === 0 ? (
                                <div className="text-center text-gray-600 mt-10 p-4 border border-dashed border-gray-800 rounded-lg">
                                    <i className="fa-solid fa-image text-3xl mb-2 opacity-20"></i>
                                    <p className="text-xs">暂无生成的图片</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {generatedImages.map((url, idx) => (
                                        <div 
                                            key={idx} 
                                            className="relative group cursor-pointer rounded-lg overflow-hidden border border-purple-900/50 shadow-md animate-in fade-in zoom-in duration-300"
                                            onClick={() => onInsert(url, 'AI Generated', 'image')}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, url, 'image')}
                                        >
                                            <img src={url} alt="AI" className="w-full h-auto object-cover" />
                                            <div className="absolute top-2 right-2 bg-purple-600 text-white text-[9px] px-2 py-0.5 rounded-full font-bold shadow-lg">AI</div>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="bg-black/60 px-3 py-1 rounded-full text-xs text-white backdrop-blur">
                                                    点击插入
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetLibrary;
