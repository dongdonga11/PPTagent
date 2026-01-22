import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle, ProjectStage } from './types';
import StageSidebar from './components/StageSidebar';
import ArticleEditor from './components/ArticleEditor';
import ChatInterface from './components/ChatInterface';
import SlidePreview from './components/SlidePreview';
import SlideList from './components/SlideList';
import CodeEditor from './components/CodeEditor';
import ScriptEditor from './components/ScriptEditor';
import PresentationRunner from './components/PresentationRunner';
import VideoStage from './components/VideoStage'; // Import VideoStage
import { generatePresentationOutline, generateSlideHtml, generateTheme, generateFullPresentationHtml } from './services/geminiService';

const DEFAULT_STYLE: GlobalStyle = {
  themeName: 'SpaceDark',
  mainColor: '#111827',
  accentColor: '#3b82f6',
  fontFamily: 'Inter, sans-serif'
};

const App: React.FC = () => {
  // --- GLOBAL STATE ---
  const [state, setState] = useState<PresentationState>({
    projectId: uuidv4(),
    title: '未命名项目',
    stage: ProjectStage.STORY, // Start at Story stage
    sourceMaterial: '',
    slides: [],
    globalStyle: DEFAULT_STYLE
  });
  
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editorMode, setEditorMode] = useState<'code' | 'script' | 'none'>('none');
  const [mode, setMode] = useState<AgentMode>(AgentMode.IDLE);
  const [isPresenting, setIsPresenting] = useState(false);

  const activeSlide = state.slides.find(s => s.id === activeSlideId) || null;

  // --- HELPERS ---
  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    const newMessage: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSlideUpdate = (id: string, updates: Partial<Slide>) => {
      setState(prev => ({
          ...prev,
          slides: prev.slides.map(s => s.id === id ? { ...s, ...updates } : s)
      }));
  };

  // --- ACTIONS ---
  
  // 1. STORY STAGE: Generate Outline from Article
  const handleGenerateScriptFromArticle = async () => {
      if (!state.sourceMaterial.trim()) return;
      
      setIsProcessing(true);
      setMode(AgentMode.PLANNER);
      addMessage('user', "请根据文案生成分镜脚本...");
      
      try {
          // Pass the full source material to the Planner
          const outline = await generatePresentationOutline(state.sourceMaterial);
          
          if (outline.length > 0) {
            const newSlides: Slide[] = outline.map(item => ({
                id: uuidv4(),
                title: item.title,
                visual_intent: item.visual_intent,
                speaker_notes: item.speaker_notes || '',
                narration: item.narration || `这是关于${item.title}的讲解。`,
                duration: item.duration || 10,
                content_html: `<div class="h-full flex flex-col justify-center items-center"><h1 class="text-6xl font-bold mb-4" data-motion="fade-up">${item.title}</h1><p class="text-xl opacity-70" data-motion="fade-up">等待视觉生成...</p></div>`,
                isGenerated: false,
                isLoading: false
            }));

            setState(prev => ({
                ...prev,
                slides: newSlides,
                stage: ProjectStage.SCRIPT // Auto advance to Script stage
            }));
            
            setActiveSlideId(newSlides[0].id);
            addMessage('assistant', `已根据您的文章拆解出 ${newSlides.length} 个分镜镜头。现已进入【脚本模式】，请检查并调整旁白。`);
          }
      } catch (e) {
          addMessage('system', "生成脚本失败: " + (e as Error).message);
      } finally {
          setIsProcessing(false);
          setMode(AgentMode.IDLE);
      }
  };

  // 2. VISUAL STAGE: Generate HTML for a slide
  const handleGenerateSlideVisual = async (slideId: string, customInstruction?: string) => {
      const slide = state.slides.find(s => s.id === slideId);
      if (!slide) return;

      setState(prev => ({
        ...prev,
        slides: prev.slides.map(s => s.id === slideId ? { ...s, isLoading: true } : s)
      }));

      try {
        // If we have custom instructions (from chat), use them. 
        // Otherwise generate based on the slide metadata.
        const html = await generateSlideHtml(slide, state.globalStyle, customInstruction);
        
        setState(prev => ({
            ...prev,
            slides: prev.slides.map(s => s.id === slideId ? { 
                ...s, 
                content_html: html,
                isGenerated: true,
                isLoading: false 
            } : s)
        }));
      } catch (e) {
         setState(prev => ({
            ...prev,
            slides: prev.slides.map(s => s.id === slideId ? { ...s, isLoading: false } : s)
         }));
      }
  };

  // 3. CHAT HANDLER (Context Aware)
  const handleSendMessage = async (text: string) => {
    addMessage('user', text);
    
    // Design Mode Check (Global)
    if (text.toLowerCase().includes('color') || text.includes('颜色') || text.includes('风格')) {
        setIsProcessing(true);
        setMode(AgentMode.DESIGNER);
        const newTheme = await generateTheme(text);
        setState(prev => ({ ...prev, globalStyle: newTheme }));
        addMessage('assistant', `主题已更新：${newTheme.themeName}`);
        setIsProcessing(false);
        setMode(AgentMode.IDLE);
        return;
    }

    // Context specific handling
    if (state.stage === ProjectStage.STORY) {
        addMessage('assistant', "请在左侧编辑器完善文案。完成后点击顶部的“AI 拆解”按钮。");
    } 
    else if (state.stage === ProjectStage.SCRIPT) {
        addMessage('assistant', "当前处于脚本模式。您可以在右侧列表选择分镜，并编辑具体的旁白和时长。确认无误后，请切换到【视觉】模式生成画面。");
    }
    else if (state.stage === ProjectStage.VISUAL) {
        if (activeSlideId) {
            setIsProcessing(true);
            setMode(AgentMode.CODER);
            await handleGenerateSlideVisual(activeSlideId, text);
            addMessage('assistant', "幻灯片视觉已更新。");
            setIsProcessing(false);
            setMode(AgentMode.IDLE);
        } else {
            addMessage('assistant', "请先选择一张幻灯片。");
        }
    } else if (state.stage === ProjectStage.EXPORT) {
        addMessage('assistant', "视频合成中心: 在时间轴上点击片段可以修改时长和字幕。");
    }
  };

  // --- RENDERERS ---

  // Renders the Middle Panel based on Stage
  const renderMainArea = () => {
    switch (state.stage) {
        case ProjectStage.STORY:
            return (
                <ArticleEditor 
                    content={state.sourceMaterial}
                    onChange={(text) => setState(prev => ({ ...prev, sourceMaterial: text }))}
                    onGenerateScript={handleGenerateScriptFromArticle}
                    isProcessing={isProcessing}
                />
            );
        
        case ProjectStage.SCRIPT:
            // Script View: List on left (wider), Script Editor on right
            return (
                <div className="flex h-full">
                     <div className="w-1/3 border-r border-gray-800 bg-gray-900 flex flex-col">
                        <SlideList 
                            slides={state.slides} 
                            activeId={activeSlideId || ''} 
                            onSelect={setActiveSlideId} 
                        />
                     </div>
                     <div className="flex-1 bg-gray-950 flex flex-col">
                        {activeSlide ? (
                            <ScriptEditor 
                                slide={activeSlide} 
                                onSave={(id, narr, dur) => handleSlideUpdate(id, { narration: narr, duration: dur })} 
                            />
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500">
                                请选择分镜进行编辑
                            </div>
                        )}
                     </div>
                </div>
            );

        case ProjectStage.EXPORT:
            // Render Studio (Video Editor)
            return (
                <VideoStage 
                    slides={state.slides}
                    globalStyle={state.globalStyle}
                    onSlideUpdate={handleSlideUpdate}
                />
            );

        case ProjectStage.VISUAL:
        default:
            // The Classic View: List -> Chat -> Preview
            return (
                 <div className="flex h-full">
                    {/* List */}
                    <SlideList 
                        slides={state.slides} 
                        activeId={activeSlideId || ''} 
                        onSelect={(id) => {
                            setActiveSlideId(id);
                            // Auto-generate if not generated when clicking in Visual Mode
                            const slide = state.slides.find(s => s.id === id);
                            if (slide && !slide.isGenerated && !slide.isLoading) {
                                handleGenerateSlideVisual(id);
                            }
                        }} 
                    />
                    
                    {/* Chat & Code Editor */}
                    <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900 border-l border-gray-800">
                         <div className={`flex-1 overflow-hidden flex flex-col ${editorMode === 'code' ? 'h-1/2' : 'h-full'}`}>
                             <ChatInterface 
                                messages={messages} 
                                onSendMessage={handleSendMessage} 
                                isProcessing={isProcessing}
                                mode={mode}
                             />
                         </div>
                         {activeSlide && editorMode === 'code' && (
                            <div className="h-1/2 flex-1 border-t border-gray-800">
                                <CodeEditor 
                                    slide={activeSlide} 
                                    onSave={(id, html) => handleSlideUpdate(id, { content_html: html })} 
                                />
                            </div>
                         )}
                    </div>

                    {/* Preview Area */}
                    <div className="flex-1 flex flex-col bg-gray-950 relative">
                        {/* Toolbar */}
                        <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900">
                            <h1 className="font-bold text-gray-300 text-sm">{state.title}</h1>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => setIsPresenting(true)}
                                    className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500"
                                >
                                    <i className="fa-solid fa-play mr-2"></i> 演示
                                </button>
                                <button 
                                    onClick={() => setEditorMode(editorMode === 'code' ? 'none' : 'code')}
                                    className={`text-xs px-3 py-1.5 rounded border ${editorMode === 'code' ? 'bg-blue-900 border-blue-500' : 'border-gray-700'}`}
                                >
                                    <i className="fa-solid fa-code"></i>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 p-8 bg-black/50 flex items-center justify-center">
                            <SlidePreview slide={activeSlide} globalStyle={state.globalStyle} />
                        </div>
                    </div>
                 </div>
            );
    }
  };

  return (
    <div className="flex h-screen w-screen text-gray-100 font-sans overflow-hidden bg-black">
      {/* 1. Global Navigation */}
      <StageSidebar 
        currentStage={state.stage} 
        onSetStage={(stage) => setState(prev => ({ ...prev, stage }))} 
      />

      {/* 2. Main Workspace (Changes based on Stage) */}
      <div className="flex-1 h-full overflow-hidden relative">
          {renderMainArea()}
      </div>

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