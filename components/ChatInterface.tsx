import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AgentMode } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  mode: AgentMode;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing, mode }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || isProcessing) return;
    onSendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider uppercase text-gray-300">
          <i className="fa-solid fa-robot mr-2 text-[var(--accent-color)]"></i> 
          SpaceCoding 智能助手
        </h2>
        <span className={`text-xs px-2 py-1 rounded-full font-mono ${
          mode === AgentMode.PLANNER ? 'bg-purple-900 text-purple-200' :
          mode === AgentMode.CODER ? 'bg-blue-900 text-blue-200' :
          'bg-gray-800 text-gray-400'
        }`}>
          {mode === AgentMode.PLANNER ? '策划' : mode === AgentMode.CODER ? '构建' : mode === AgentMode.DESIGNER ? '设计' : '空闲'}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
                <i className="fa-solid fa-wand-magic-sparkles text-3xl mb-3"></i>
                <p>描述您的演示主题以开始。</p>
                <p className="text-xs mt-2">"制作一份关于咖啡创业公司的商业计划书"</p>
            </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-700 text-white rounded-br-none'
                  : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'
              }`}
            >
              {msg.role === 'assistant' && (
                 <div className="mb-1 text-xs text-gray-500 font-mono">Agent</div>
              )}
              {msg.content}
            </div>
          </div>
        ))}
        {isProcessing && (
            <div className="flex justify-start">
                 <div className="bg-gray-800 rounded-lg p-3 rounded-bl-none border border-gray-700 flex items-center gap-2 text-sm text-gray-400">
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    思考中...
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在此输入指令..."
            className="w-full bg-gray-800 text-white rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none h-14 text-sm"
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className={`absolute right-2 top-2 p-2 rounded-md transition-colors ${
              !input.trim() || isProcessing
                ? 'text-gray-600 cursor-not-allowed'
                : 'text-blue-400 hover:bg-gray-700'
            }`}
          >
            <i className="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;