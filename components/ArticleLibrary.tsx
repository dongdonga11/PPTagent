
import React from 'react';
import { Article, AppMode } from '../types';

interface ArticleLibraryProps {
    articles: Article[];
    onEdit: (article: Article) => void;
    onDelete: (id: string) => void;
    onCreateNew: () => void;
    onDerive: (article: Article, targetMode: AppMode) => void;
}

interface StatCardProps {
    label: string;
    value: string | number;
    icon: string;
    color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
    return (
        <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 flex items-center gap-4 hover:border-gray-700 transition-colors shadow-lg">
            <div className={`w-12 h-12 rounded-full ${color} flex items-center justify-center text-xl shrink-0`}>
                <i className={icon}></i>
            </div>
            <div>
                <div className="text-2xl font-bold text-white font-mono">{value}</div>
                <div className="text-xs text-gray-500 uppercase tracking-wider font-bold">{label}</div>
            </div>
        </div>
    );
};

const ArticleLibrary: React.FC<ArticleLibraryProps> = ({ 
    articles, 
    onEdit, 
    onDelete, 
    onCreateNew,
    onDerive 
}) => {
    // --- Stats Calculation ---
    const totalArticles = articles.length;
    const totalWords = articles.reduce((acc, curr) => acc + (curr.plainText?.length || 0), 0);
    // Mock data for demonstration of the "Full Media" concept
    const derivedWorks = Math.floor(totalArticles * 1.5); 
    const hotTopicsTracked = 12;

    return (
        <div className="flex-1 h-full bg-[#0F0F12] overflow-y-auto custom-scrollbar p-10">
            <div className="max-w-7xl mx-auto">
                
                {/* 1. HERO SECTION: Welcome */}
                <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 tracking-tight mb-3">
                        准备好今天的创作了吗？
                    </h1>
                    <p className="text-gray-400 text-sm flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        SpaceCoding 媒体工坊已就绪，今天是 {new Date().toLocaleDateString()}，祝您灵感迸发。
                    </p>
                </div>

                {/* 2. DATA DISPLAY: Stats Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                    <StatCard 
                        label="核心文章库" 
                        value={totalArticles} 
                        icon="fa-regular fa-file-lines" 
                        color="bg-indigo-900/30 text-indigo-400 border border-indigo-500/30"
                    />
                    <StatCard 
                        label="累计创作字数" 
                        value={totalWords.toLocaleString()} 
                        icon="fa-solid fa-align-left" 
                        color="bg-blue-900/30 text-blue-400 border border-blue-500/30"
                    />
                    <StatCard 
                        label="衍生多媒体" 
                        value={derivedWorks} 
                        icon="fa-solid fa-layer-group" 
                        color="bg-purple-900/30 text-purple-400 border border-purple-500/30"
                    />
                    <StatCard 
                        label="追踪热点" 
                        value={hotTopicsTracked} 
                        icon="fa-solid fa-fire" 
                        color="bg-orange-900/30 text-orange-400 border border-orange-500/30"
                    />
                </div>

                {/* 3. MEDIA ASSETS SECTION */}
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="flex items-end justify-between mb-6 border-b border-gray-800 pb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <i className="fa-solid fa-folder-open text-gray-500"></i>
                            媒体库资产 (Assets)
                        </h2>
                        
                        <div className="flex gap-3">
                            <div className="relative">
                                <i className="fa-solid fa-search absolute left-3 top-2.5 text-gray-600 text-xs"></i>
                                <input 
                                    type="text" 
                                    placeholder="搜索标题..." 
                                    className="bg-[#141414] border border-gray-800 text-gray-300 text-xs rounded-lg pl-8 pr-4 py-2 focus:outline-none focus:border-indigo-500 w-48 transition-all"
                                />
                            </div>
                            <button 
                                onClick={onCreateNew}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-indigo-900/20 flex items-center gap-2 transition-all hover:scale-105"
                            >
                                <i className="fa-solid fa-plus"></i> 新建文章
                            </button>
                        </div>
                    </div>

                    {/* Empty State */}
                    {articles.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-80 border-2 border-dashed border-gray-800 rounded-2xl bg-[#141414]/50">
                            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                <i className="fa-solid fa-feather-pointed text-2xl text-gray-600"></i>
                            </div>
                            <h3 className="text-lg font-bold text-gray-300 mb-1">开始第一次创作</h3>
                            <p className="text-gray-500 text-xs mb-6">撰写核心文章，随后即可一键生成视频、PPT与海报。</p>
                            <button onClick={onCreateNew} className="text-indigo-400 hover:text-white underline underline-offset-4 text-sm">
                                创建新文章 &gt;
                            </button>
                        </div>
                    )}

                    {/* Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {articles.map(article => (
                            <div key={article.id} className="bg-[#1a1a1a] rounded-xl border border-gray-800 hover:border-indigo-500/50 transition-all group flex flex-col h-[280px] overflow-hidden relative shadow-lg hover:shadow-2xl hover:-translate-y-1">
                                
                                {/* Card Body */}
                                <div className="p-5 flex-1 flex flex-col cursor-pointer" onClick={() => onEdit(article)}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex gap-1.5 flex-wrap">
                                            {article.tags.map(tag => (
                                                <span key={tag} className="text-[9px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-[9px] text-gray-600 font-mono">
                                            {new Date(article.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <h3 className="text-base font-bold text-gray-100 mb-2 line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
                                        {article.title}
                                    </h3>
                                    <div className="text-xs text-gray-500 line-clamp-4 leading-relaxed flex-1 overflow-hidden relative">
                                        {article.plainText}
                                        {/* Fade out effect */}
                                        <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-[#1a1a1a] to-transparent"></div>
                                    </div>
                                </div>

                                {/* Actions Footer */}
                                <div className="bg-[#111] px-4 py-3 border-t border-gray-800 flex justify-between items-center z-10">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onEdit(article); }}
                                        className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1.5 hover:bg-gray-800 px-2 py-1 rounded transition-colors"
                                    >
                                        <i className="fa-solid fa-pen-to-square"></i> 编辑
                                    </button>

                                    <div className="flex items-center gap-2">
                                        {/* Derive Menu */}
                                        <div className="relative group/menu">
                                            <button className="text-[10px] bg-indigo-900/20 text-indigo-300 hover:bg-indigo-600 hover:text-white px-2.5 py-1 rounded flex items-center gap-1.5 border border-indigo-900/30 transition-all">
                                                <i className="fa-solid fa-wand-magic-sparkles"></i> 衍生
                                            </button>
                                            
                                            <div className="absolute bottom-full right-0 mb-2 w-32 bg-[#222] border border-gray-700 rounded-lg shadow-xl overflow-hidden hidden group-hover/menu:block animate-in fade-in slide-in-from-bottom-1 z-50">
                                                <button onClick={() => onDerive(article, AppMode.PRESENTATION)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-indigo-600 hover:text-white flex gap-2 items-center">
                                                    <i className="fa-solid fa-person-chalkboard w-3"></i> 转 PPT
                                                </button>
                                                <button onClick={() => onDerive(article, AppMode.VIDEO)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-purple-600 hover:text-white flex gap-2 items-center">
                                                    <i className="fa-solid fa-video w-3"></i> 转视频
                                                </button>
                                                <button onClick={() => onDerive(article, AppMode.POSTER)} className="w-full text-left px-3 py-2 text-[10px] text-gray-300 hover:bg-pink-600 hover:text-white flex gap-2 items-center">
                                                    <i className="fa-solid fa-image w-3"></i> 转海报
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(confirm('确定删除?')) onDelete(article.id); }}
                                            className="w-6 h-6 flex items-center justify-center text-gray-600 hover:text-red-500 rounded hover:bg-gray-800 transition-colors"
                                            title="删除"
                                        >
                                            <i className="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ArticleLibrary;
