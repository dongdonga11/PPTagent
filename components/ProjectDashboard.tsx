
import React from 'react';
import { ProjectStage, Slide } from '../types';

interface ProjectDashboardProps {
    title: string;
    sourceWordCount: number;
    slidesCount: number;
    videoDuration: number;
    onNavigate: (stage: ProjectStage) => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ 
    title, 
    sourceWordCount, 
    slidesCount, 
    videoDuration, 
    onNavigate 
}) => {
    
    // Calculate progress percentages (mock logic for demo)
    const articleProgress = sourceWordCount > 50 ? 100 : sourceWordCount > 0 ? 30 : 0;
    const videoProgress = slidesCount > 0 ? Math.min(100, slidesCount * 10) : 0;
    
    return (
        <div className="flex-1 h-full bg-[#0F0F12] overflow-y-auto custom-scrollbar p-8">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-end justify-between mb-12 border-b border-gray-800 pb-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                             <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold">
                                <i className="fa-solid fa-rocket"></i>
                             </div>
                             <span className="text-xs font-mono text-gray-500 tracking-widest uppercase">SpaceCoding OS</span>
                        </div>
                        <h1 className="text-4xl font-bold text-white tracking-tight">{title}</h1>
                        <p className="text-gray-400 mt-2 text-sm">全媒体内容资产管理控制台 (Central Kitchen)</p>
                    </div>
                    <div className="text-right">
                         <div className="text-xs text-gray-500 uppercase mb-1">Total Assets</div>
                         <div className="text-2xl font-mono text-blue-400 font-bold">
                            {slidesCount > 0 ? '3' : sourceWordCount > 0 ? '1' : '0'} <span className="text-sm text-gray-600">types</span>
                         </div>
                    </div>
                </div>

                {/* 1. MASTER CONTENT (Core) */}
                <div className="mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-database text-blue-500"></i> 母版内容 (Source Material)
                    </h2>
                    <div 
                        className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-6 flex items-center justify-between hover:border-blue-500/50 transition-all cursor-pointer group relative overflow-hidden"
                        onClick={() => onNavigate(ProjectStage.STORY)}
                    >
                         <div className="absolute inset-0 bg-gradient-to-r from-blue-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                         <div className="flex items-start gap-4 z-10">
                            <div className="w-12 h-12 rounded bg-blue-900/20 text-blue-400 flex items-center justify-center text-xl border border-blue-900/50">
                                <i className="fa-regular fa-file-lines"></i>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-200 group-hover:text-white transition-colors">核心文案 / 公众号文章</h3>
                                <div className="text-sm text-gray-500 mt-1 flex gap-4">
                                    <span><i className="fa-solid fa-pen-nib mr-1"></i> {sourceWordCount} 字</span>
                                    <span><i className="fa-solid fa-clock mr-1"></i> 阅读约 {Math.ceil(sourceWordCount / 400)} 分钟</span>
                                    {articleProgress === 100 && <span className="text-green-500"><i className="fa-solid fa-check-circle"></i> 已就绪</span>}
                                </div>
                            </div>
                         </div>
                         <button className="z-10 bg-gray-800 hover:bg-blue-600 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg border border-gray-700 hover:border-blue-500">
                            进入 CMS 编辑器 &gt;
                         </button>
                    </div>
                </div>

                {/* 2. DISTRIBUTION MATRIX (Outputs) */}
                <div>
                    <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-share-nodes text-green-500"></i> 分发矩阵 (Distribution Matrix)
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Video Card */}
                        <div 
                            className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5 flex flex-col hover:border-purple-500/50 transition-all group relative overflow-hidden cursor-pointer h-48"
                            onClick={() => onNavigate(ProjectStage.SCRIPT)}
                        >
                             <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="w-10 h-10 rounded bg-purple-900/20 text-purple-400 flex items-center justify-center border border-purple-900/50">
                                    <i className="fa-solid fa-video"></i>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${videoProgress > 0 ? 'bg-green-900/20 text-green-400 border-green-900' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                    {videoProgress > 0 ? '制作中' : '未开始'}
                                </span>
                             </div>
                             <h3 className="text-base font-bold text-gray-200 mb-1 relative z-10">短视频 / B站</h3>
                             <p className="text-xs text-gray-500 relative z-10 mb-4">A2S 脚本引擎 + AI 视觉</p>
                             
                             <div className="mt-auto relative z-10 flex justify-between items-end">
                                 <div className="text-[10px] text-gray-600 font-mono">
                                     {slidesCount} 分镜 · {videoDuration}s
                                 </div>
                                 <i className="fa-solid fa-arrow-right text-gray-600 group-hover:text-purple-400 transform group-hover:translate-x-1 transition-all"></i>
                             </div>
                             {/* Progress Bar */}
                             <div className="absolute bottom-0 left-0 h-1 bg-purple-600/50 transition-all duration-1000" style={{ width: `${videoProgress}%` }}></div>
                        </div>

                        {/* Presentation Card */}
                        <div 
                            className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5 flex flex-col hover:border-yellow-500/50 transition-all group relative overflow-hidden cursor-pointer h-48"
                            onClick={() => onNavigate(ProjectStage.VISUAL)}
                        >
                             <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="w-10 h-10 rounded bg-yellow-900/20 text-yellow-400 flex items-center justify-center border border-yellow-900/50">
                                    <i className="fa-solid fa-person-chalkboard"></i>
                                </div>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${slidesCount > 0 ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900' : 'bg-gray-800 text-gray-500 border-gray-700'}`}>
                                    {slidesCount > 0 ? '可预览' : '未生成'}
                                </span>
                             </div>
                             <h3 className="text-base font-bold text-gray-200 mb-1 relative z-10">课程讲义 / PPT</h3>
                             <p className="text-xs text-gray-500 relative z-10 mb-4">Web Slide 实时渲染</p>
                             
                             <div className="mt-auto relative z-10 flex justify-between items-end">
                                 <div className="text-[10px] text-gray-600 font-mono">
                                     16:9 宽屏适配
                                 </div>
                                 <i className="fa-solid fa-arrow-right text-gray-600 group-hover:text-yellow-400 transform group-hover:translate-x-1 transition-all"></i>
                             </div>
                        </div>

                        {/* RedBook / Poster Card (New Concept) */}
                        <div 
                            className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5 flex flex-col hover:border-pink-500/50 transition-all group relative overflow-hidden cursor-pointer h-48 opacity-60 hover:opacity-100"
                            onClick={() => alert("小红书/海报生成模块 (Poster Engine) 即将上线。\n功能前瞻：\n1. AI 提取金句\n2. 竖屏排版引擎\n3. 一键生成封面图")}
                        >
                             <div className="flex justify-between items-start mb-4 relative z-10">
                                <div className="w-10 h-10 rounded bg-pink-900/20 text-pink-400 flex items-center justify-center border border-pink-900/50">
                                    <i className="fa-solid fa-image-portrait"></i>
                                </div>
                                <span className="text-[10px] px-2 py-0.5 rounded-full border bg-gray-800 text-gray-500 border-gray-700">
                                    即将上线
                                </span>
                             </div>
                             <h3 className="text-base font-bold text-gray-200 mb-1 relative z-10">小红书 / 海报</h3>
                             <p className="text-xs text-gray-500 relative z-10 mb-4">3:4 竖屏金句卡片生成</p>
                             
                             <div className="mt-auto relative z-10 flex justify-between items-end">
                                 <div className="text-[10px] text-gray-600 font-mono">
                                     Waiting for Module...
                                 </div>
                                 <i className="fa-solid fa-lock text-gray-600"></i>
                             </div>
                        </div>
                    </div>
                </div>

                {/* 3. QUICK ACTIONS (Footer) */}
                <div className="mt-12 pt-8 border-t border-gray-800 flex gap-4">
                    <button 
                         onClick={() => onNavigate(ProjectStage.RESEARCH)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#222] hover:bg-[#333] rounded-lg text-sm text-gray-300 transition-colors"
                    >
                        <i className="fa-solid fa-magnifying-glass"></i> 新建选题调研
                    </button>
                     <button className="flex items-center gap-2 px-4 py-2 bg-[#222] hover:bg-[#333] rounded-lg text-sm text-gray-300 transition-colors opacity-50 cursor-not-allowed" title="连接 API 后可用">
                        <i className="fa-solid fa-cloud-arrow-up"></i> 一键发布 (Coming Soon)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProjectDashboard;
