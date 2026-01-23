import React, { useState } from 'react';
import { performResearchAndIdeation } from '../services/geminiService';
import { ResearchTopic } from '../types';

interface ResearchPanelProps {
    onSelectTopic: (topic: ResearchTopic) => void;
}

const ResearchPanel: React.FC<ResearchPanelProps> = ({ onSelectTopic }) => {
    const [keyword, setKeyword] = useState('');
    const [fileContent, setFileContent] = useState('');
    const [fileName, setFileName] = useState('');
    const [topics, setTopics] = useState<ResearchTopic[]>([]);
    const [isResearching, setIsResearching] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileName(file.name);
            setFileContent(`[File: ${file.name}] ... (Simulated Content) ...`);
        }
    };

    const handleSearch = async () => {
        if (!keyword && !fileContent) return;
        setIsResearching(true);
        try {
            const results = await performResearchAndIdeation(keyword, fileContent);
            setTopics(results);
        } catch (e) {
            alert("Research failed");
        } finally {
            setIsResearching(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-[#0f0f12] h-full overflow-hidden">
            <div className="p-8 pb-4">
                <h1 className="text-2xl font-bold text-white mb-2">
                    <span className="text-blue-500 mr-2">●</span>情报雷达 (Research Radar)
                </h1>
                <p className="text-gray-400 text-sm">全网搜索热点，结合本地资料，AI 为您生成爆款选题。</p>
            </div>

            <div className="px-8 mb-8">
                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800 shadow-xl max-w-4xl">
                    <div className="flex gap-4 mb-4">
                        <div className="flex-1 relative">
                            <i className="fa-solid fa-search absolute left-3 top-3.5 text-gray-500"></i>
                            <input 
                                type="text" 
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="输入行业关键词（如：AI 教育、考研新规）..."
                                className="w-full bg-[#111] border border-gray-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:border-blue-500"
                            />
                        </div>
                        <div className="relative">
                            <input type="file" id="file-upload" className="hidden" onChange={handleFileUpload} />
                            <label htmlFor="file-upload" className="h-full px-4 bg-gray-800 border border-gray-700 rounded-lg flex items-center text-gray-300 hover:text-white hover:bg-gray-700 cursor-pointer transition-colors">
                                <i className="fa-solid fa-file-arrow-up mr-2"></i>{fileName ? '已投喂' : '投喂资料'}
                            </label>
                        </div>
                        <button onClick={handleSearch} disabled={isResearching} className="bg-blue-600 hover:bg-blue-500 text-white px-8 rounded-lg font-bold shadow-lg disabled:opacity-50">
                            {isResearching ? <i className="fa-solid fa-circle-notch fa-spin"></i> : '开始挖掘'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 custom-scrollbar">
                {topics.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8 max-w-6xl">
                        {topics.map((topic) => (
                            <div key={topic.id} onClick={() => onSelectTopic(topic)} className="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800 hover:border-blue-500 hover:bg-[#222] cursor-pointer group transition-all relative">
                                <div className="flex justify-between items-start mb-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${topic.hotScore > 85 ? 'bg-red-900/50 text-red-400 border border-red-800' : 'bg-blue-900/50 text-blue-400 border border-blue-800'}`}>
                                        热度 {topic.hotScore}
                                    </span>
                                </div>
                                <h3 className="text-lg font-bold text-gray-100 mb-2 leading-snug group-hover:text-blue-400">{topic.title}</h3>
                                <p className="text-xs text-gray-500 line-clamp-2">{topic.coreViewpoint}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
export default ResearchPanel;
