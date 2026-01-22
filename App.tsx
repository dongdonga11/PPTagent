import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle } from './types';
import ChatInterface from './components/ChatInterface';
import SlidePreview from './components/SlidePreview';
import SlideList from './components/SlideList';
import CodeEditor from './components/CodeEditor';
import PresentationRunner from './components/PresentationRunner'; // Import the new runner
import { generatePresentationOutline, generateSlideHtml, generateTheme, generateFullPresentationHtml } from './services/geminiService';

const DEFAULT_STYLE: GlobalStyle = {
  themeName: 'SpaceDark',
  mainColor: '#111827', // gray-900
  accentColor: '#3b82f6', // blue-500
  fontFamily: 'Inter, sans-serif'
};

const App: React.FC = () => {
  const [state, setState] = useState<PresentationState>({
    projectId: uuidv4(),
    title: '未命名项目',
    slides: [],
    globalStyle: DEFAULT_STYLE
  });
  
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [mode, setMode] = useState<AgentMode>(AgentMode.IDLE);
  
  // State for Full Screen Presentation Mode
  const [isPresenting, setIsPresenting] = useState(false);

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const activeSlide = state.slides.find(s => s.id === activeSlideId) || null;

  // Handle User Input
  const handleSendMessage = async (text: string) => {
    addMessage('user', text);
    setIsProcessing(true);

    try {
      // SCENARIO 1: No slides yet -> Planner Agent
      if (state.slides.length === 0) {
        setMode(AgentMode.PLANNER);
        
        // Parallel: Theme + Outline
        const [outline, theme] = await Promise.all([
             generatePresentationOutline(text),
             generateTheme(text)
        ]);

        if (outline.length > 0) {
           const newSlides: Slide[] = outline.map(item => ({
             id: uuidv4(),
             title: item.title,
             visual_intent: item.visual_intent,
             speaker_notes: item.speaker_notes,
             content_html: `<div class="h-full flex flex-col justify-center items-center"><h1 class="text-6xl font-bold mb-4">${item.title}</h1><p class="text-xl opacity-70">正在生成内容...</p></div>`,
             isGenerated: false,
             isLoading: false
           }));

           setState(prev => ({
             ...prev,
             title: text.substring(0, 30),
             slides: newSlides,
             globalStyle: theme
           }));
           
           setActiveSlideId(newSlides[0].id);
           addMessage('assistant', `我已根据“${text}”为您生成了包含 ${newSlides.length} 页幻灯片的大纲。已应用 ${theme.themeName} 主题。`);
           
           // Trigger generation for first slide automatically
           triggerSlideGeneration(newSlides[0].id, newSlides[0], theme);
        } else {
            addMessage('assistant', "无法生成大纲，请提供更多关于演示文稿的细节。");
        }
      } 
      // SCENARIO 2: Has slides -> Refinement or Global Change
      else {
        // Simple heuristic for Designer request
        if (text.toLowerCase().includes('color') || text.toLowerCase().includes('style') || text.toLowerCase().includes('theme') || text.includes('颜色') || text.includes('风格')) {
            setMode(AgentMode.DESIGNER);
            const newTheme = await generateTheme(text);
            setState(prev => ({ ...prev, globalStyle: newTheme }));
            addMessage('assistant', `已更新主题为 ${newTheme.themeName} (主色: ${newTheme.mainColor}, 强调色: ${newTheme.accentColor})`);
        } 
        // Otherwise, it's a Coder request for the ACTIVE slide
        else if (activeSlideId) {
            setMode(AgentMode.CODER);
            const slide = state.slides.find(s => s.id === activeSlideId);
            if (slide) {
                await triggerSlideGeneration(slide.id, slide, state.globalStyle, text);
                addMessage('assistant', `已根据您的反馈更新幻灯片“${slide.title}”。`);
            }
        }
      }
    } catch (error) {
      console.error(error);
      addMessage('system', "处理您的请求时发生错误。");
    } finally {
      setIsProcessing(false);
      setMode(AgentMode.IDLE);
    }
  };

  const triggerSlideGeneration = async (id: string, slideMetadata: Slide, style: GlobalStyle, refinementInstruction?: string) => {
    setState(prev => ({
        ...prev,
        slides: prev.slides.map(s => s.id === id ? { ...s, isLoading: true } : s)
    }));

    try {
        const html = await generateSlideHtml(slideMetadata, style, refinementInstruction);
        setState(prev => ({
            ...prev,
            slides: prev.slides.map(s => s.id === id ? { 
                ...s, 
                content_html: html,
                isGenerated: true,
                isLoading: false 
            } : s)
        }));
    } catch (e) {
        console.error("Failed to generate slide", e);
        setState(prev => ({
            ...prev,
            slides: prev.slides.map(s => s.id === id ? { ...s, isLoading: false } : s)
        }));
    }
  };

  const handleSelectSlide = (id: string) => {
    setActiveSlideId(id);
    const slide = state.slides.find(s => s.id === id);
    if (slide && !slide.isGenerated && !slide.isLoading) {
        triggerSlideGeneration(id, slide, state.globalStyle);
    }
  };

  const handleManualCodeSave = (id: string, newHtml: string) => {
      setState(prev => ({
          ...prev,
          slides: prev.slides.map(s => s.id === id ? { ...s, content_html: newHtml } : s)
      }));
  };

  // Export static HTML
  const handleDownload = () => {
      const fullHtml = generateFullPresentationHtml(state.slides, state.globalStyle);
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presentation-${state.projectId}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-screen text-gray-100 font-sans overflow-hidden">
      {/* LEFT: Sidebar List */}
      <SlideList 
        slides={state.slides} 
        activeId={activeSlideId || ''} 
        onSelect={handleSelectSlide} 
      />

      {/* MIDDLE: Chat & Editor */}
      <div className="w-96 flex flex-col border-r border-gray-800 bg-gray-900 transition-all duration-300">
        <div className={`flex-1 overflow-hidden flex flex-col ${showCode ? 'h-1/2' : 'h-full'}`}>
             <ChatInterface 
                messages={messages} 
                onSendMessage={handleSendMessage} 
                isProcessing={isProcessing}
                mode={mode}
             />
        </div>
        {activeSlide && showCode && (
            <div className="h-1/2 flex-1 overflow-hidden">
                <CodeEditor slide={activeSlide} onSave={handleManualCodeSave} />
            </div>
        )}
      </div>

      {/* RIGHT: Preview */}
      <div className="flex-1 flex flex-col bg-gray-950 relative">
        {/* Toolbar */}
        <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900">
            <h1 className="font-bold text-gray-300 text-sm tracking-widest truncate max-w-xs">{state.title}</h1>
            <div className="flex gap-3">
                 <button 
                    onClick={() => setIsPresenting(true)}
                    className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition-colors font-semibold shadow-lg shadow-blue-900/50"
                 >
                    <i className="fa-solid fa-play mr-2"></i>
                    演示动画
                 </button>
                 <button 
                    onClick={() => setShowCode(!showCode)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${showCode ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'border-gray-700 text-gray-400 hover:text-white'}`}
                 >
                    <i className="fa-solid fa-code mr-2"></i>
                    {showCode ? '隐藏代码' : '显示代码'}
                 </button>
                 <button 
                    onClick={handleDownload}
                    className="text-xs px-3 py-1.5 rounded border border-gray-700 text-gray-400 hover:text-white transition-colors"
                 >
                    <i className="fa-solid fa-download mr-2"></i>
                    导出HTML
                 </button>
            </div>
        </div>
        
        {/* Main Canvas */}
        <div className="flex-1 p-8 bg-black/50 overflow-hidden flex items-center justify-center">
            <SlidePreview slide={activeSlide} globalStyle={state.globalStyle} />
        </div>

        {/* Note Display (Optional footer) */}
        {activeSlide && (
             <div className="h-12 border-t border-gray-800 bg-gray-900 flex items-center px-4 text-xs text-gray-500 font-mono">
                <span className="font-bold text-gray-400 mr-2">演讲备注:</span>
                <span className="truncate">{activeSlide.speaker_notes}</span>
             </div>
        )}
      </div>

      {/* NEW Presentation Runner Overlay */}
      {isPresenting && (
          <PresentationRunner 
              slides={state.slides} 
              globalStyle={state.globalStyle}
              onClose={() => setIsPresenting(false)}
          />
      )}
    </div>
  );
};

export default App;