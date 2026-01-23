
import React, { useState, useEffect } from 'react';
import { getProfile, saveProfile } from '../services/styleManager';
import { UserStyleProfile } from '../types';

interface GlobalSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GlobalSettingsModal: React.FC<GlobalSettingsModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'general' | 'github'>('general');
    const [profile, setProfile] = useState<UserStyleProfile>(getProfile());

    useEffect(() => {
        if (isOpen) {
            setProfile(getProfile());
        }
    }, [isOpen]);

    const handleSave = () => {
        saveProfile(profile);
        onClose();
    };

    const updateGitHub = (key: string, val: string) => {
        setProfile(prev => ({
            ...prev,
            githubConfig: { ...prev.githubConfig, [key]: val } as any
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[600px] bg-[#1a1a1a] rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="h-14 px-6 border-b border-gray-700 flex items-center justify-between bg-[#141414]">
                    <h2 className="text-white font-bold flex items-center gap-2">
                        <i className="fa-solid fa-sliders text-blue-500"></i> 全局设置
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-700 bg-[#111]">
                    <button 
                        onClick={() => setActiveTab('general')}
                        className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'general' ? 'border-blue-500 text-blue-400 bg-blue-900/10' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        AI 偏好设置
                    </button>
                    <button 
                        onClick={() => setActiveTab('github')}
                        className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${activeTab === 'github' ? 'border-gray-200 text-white bg-gray-800' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                    >
                        <i className="fa-brands fa-github mr-2"></i>GitHub 集成
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-2">用户称呼 (Persona Name)</label>
                                <input 
                                    type="text" 
                                    value={profile.name}
                                    onChange={(e) => setProfile({...profile, name: e.target.value})}
                                    className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-2">AI 语气风格 (Tone)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['Professional', 'Witty', 'Emotional'].map(tone => (
                                        <button
                                            key={tone}
                                            onClick={() => setProfile({...profile, tone})}
                                            className={`py-3 rounded border text-xs font-bold transition-all
                                                ${profile.tone === tone 
                                                    ? 'bg-blue-600 border-blue-500 text-white' 
                                                    : 'bg-[#222] border-gray-700 text-gray-400 hover:border-gray-500'}
                                            `}
                                        >
                                            {tone === 'Professional' && '专业严谨'}
                                            {tone === 'Witty' && '幽默风趣'}
                                            {tone === 'Emotional' && '情感共鸣'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-2">文章默认结尾 (Signature)</label>
                                <textarea 
                                    value={profile.preferredEnding}
                                    onChange={(e) => setProfile({...profile, preferredEnding: e.target.value})}
                                    className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none min-h-[80px]"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'github' && (
                        <div className="space-y-6">
                            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 mb-4">
                                <p className="text-xs text-gray-400 leading-relaxed">
                                    配置 GitHub Token 后，您可以直接将文章、脚本推送到指定的仓库中，实现内容版本管理。
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Personal Access Token</label>
                                <input 
                                    type="password" 
                                    value={profile.githubConfig?.token || ''}
                                    onChange={(e) => updateGitHub('token', e.target.value)}
                                    placeholder="ghp_xxxxxxxxxxxx"
                                    className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none font-mono"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Owner (User/Org)</label>
                                    <input 
                                        type="text" 
                                        value={profile.githubConfig?.owner || ''}
                                        onChange={(e) => updateGitHub('owner', e.target.value)}
                                        placeholder="e.g. facebook"
                                        className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Repository</label>
                                    <input 
                                        type="text" 
                                        value={profile.githubConfig?.repo || ''}
                                        onChange={(e) => updateGitHub('repo', e.target.value)}
                                        placeholder="e.g. react"
                                        className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Branch</label>
                                    <input 
                                        type="text" 
                                        value={profile.githubConfig?.branch || 'main'}
                                        onChange={(e) => updateGitHub('branch', e.target.value)}
                                        className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase block mb-2">Path (Folder)</label>
                                    <input 
                                        type="text" 
                                        value={profile.githubConfig?.path || ''}
                                        onChange={(e) => updateGitHub('path', e.target.value)}
                                        placeholder="e.g. posts/"
                                        className="w-full bg-[#111] border border-gray-700 rounded p-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-700 bg-[#141414] flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded text-sm font-bold text-gray-400 hover:text-white transition-colors">
                        取消
                    </button>
                    <button onClick={handleSave} className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold shadow-lg transition-colors">
                        保存配置
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalSettingsModal;
