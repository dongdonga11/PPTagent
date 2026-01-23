
import React, { useRef, useEffect } from 'react';
import { CMSMessage } from '../types';

interface CMSChatPanelProps {
    messages: CMSMessage[];
    onSendMessage: (text: string) => void;
    onOptionSelect: (value: string, label: string) => void;
    isTyping: boolean;
}

const CMSChatPanel: React.FC<CMSChatPanelProps> = ({ messages, onSendMessage, onOptionSelect, isTyping }) => {
    const [input, setInput] = React.useState('');
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full bg-[#141414] border-r border-gray-800 w-80 shrink-0">
            {/* Header */}
            <div className="h-14 flex items-center px-4 border-b border-gray-800 bg-[#1a1a1a]">
                <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    智能编排助手 (Agent)
                </h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Message Bubble */}
                        <div className={`
                            max-w-[90%] rounded-xl p-3 text-sm leading-relaxed shadow-sm
                            ${msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-br-none' 
                                : 'bg-[#222] text-gray-200 rounded-bl-none border border-gray-700'}
                        `}>
                            {msg.content}
                        </div>

                        {/* UI Options (Buttons) */}
                        {msg.uiOptions && !msg.isActionExecuted && (
                            <div className="mt-3 grid grid-cols-1 gap-2 w-full max-w-[90%] animate-in slide-in-from-top-2 duration-300">
                                {msg.uiOptions.map((opt, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => onOptionSelect(opt.value, opt.label)}
                                        className="text-left px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] border border-gray-700 hover:border-blue-500 rounded-lg text-xs text-blue-300 transition-all flex items-center gap-2 group"
                                    >
                                        <span className="w-5 h-5 rounded-full bg-blue-900/30 text-blue-400 flex items-center justify-center text-[10px] group-hover:bg-blue-600 group-hover:text-white">
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                         {/* Selection Feedback State */}
                        {msg.uiOptions && msg.isActionExecuted && (
                            <div className="mt-1 text-[10px] text-gray-500 flex items-center gap-1">
                                <i className="fa-solid fa-check"></i> 已选择
                            </div>
                        )}
                    </div>
                ))}

                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-[#222] rounded-xl rounded-bl-none p-3 border border-gray-700 flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-100"></span>
                            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-[#1a1a1a] border-t border-gray-800">
                <div className="relative">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="给 Agent 发指令..."
                        className="w-full bg-[#0F0F12] text-gray-200 text-xs px-3 py-3 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 pr-10"
                        disabled={isTyping}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 top-2 p-1 text-blue-500 hover:text-white disabled:opacity-30"
                    >
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CMSChatPanel;
