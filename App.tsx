
import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle, ProjectStage } from './types';
import StageSidebar from './components/StageSidebar';
import ArticleEditor from './components/ArticleEditor';
import ChatInterface from './components/ChatInterface';
import SlidePreview from './components/SlidePreview';
import SlideList from './components/SlideList';
import CodeEditor from './components/CodeEditor';
import ScriptStoryboard from './components/ScriptStoryboard'; // NEW
import PresentationRunner from './components/PresentationRunner';
import VideoStage from './components/VideoStage'; 
import { generatePresentationOutline, generateSlideHtml, generateTheme } from './services/geminiService';
import { calculateDuration } from './utils/scriptUtils'; // NEW

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
  
  // 1. STORY STAGE: A2S - Article to Scenes
  const handleGenerateScriptFromArticle = async () => {
      if (!state.sourceMaterial.trim()) return;
      
      setIsProcessing(true);
      setMode(AgentMode.PLANNER);
      addMessage('user', "正在启动脚本工厂，拆解分镜中...");
      
      try {
          // Pass the full source material to the Planner (Director Mode)
          const scenes = await generatePresentationOutline(state.sourceMaterial);
          
          if (scenes.length > 0) {
            const newSlides: Slide[] = scenes.map(item => ({
                id: uuidv4(),
                title: item.title,
                visual_intent: item.visual_intent,
                visual_layout: item.visual_layout || 'Cover', // Layout from AI
                speaker_notes: item.speaker_notes || '',
                narration: item.narration || '',
                duration: item.duration || calculateDuration(item.narration || ''),
                content_html: '', // Empty initially, wait for visual generation
                isGenerated: false,
                isLoading: false
            }));

            setState(prev => ({
                ...prev,
                slides: newSlides,
                stage: ProjectStage.SCRIPT // Auto advance to Script Factory
            }));
            
            setActiveSlideId(newSlides[0].id);
            addMessage('assistant', `✅ 拆解完成！共生成 ${newSlides.length} 个分镜场景。已切换至【脚本工厂】模式，请微调口播文案和布局。`);
          }
      } catch (e) {
          addMessage('system', "拆解失败: " + (e as Error).message);
      } finally {
          setIsProcessing(false);
          setMode(AgentMode.IDLE);
      }
  };

  // 2. VISUAL STAGE (Can be triggered from Script Factory now)
  const handleGenerateSlideVisual = async (slideId: string, customInstruction?: string) => {
      const slide = state.slides.find(s => s.id === slideId);
      if (!slide) return;

      // Optimistic update
      handleSlideUpdate(slideId, { isLoading: true });

      try {
        const html = await generateSlideHtml(slide, state.globalStyle, customInstruction);
        
        handleSlideUpdate(slideId, { 
            content_html: html,
            isGenerated: true,
            isLoading: false 
        });
      } catch (e) {
         handleSlideUpdate(slideId, { isLoading: false });
         console.error(e);
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
        addMessage('assistant', "您在脚本工厂中。修改左侧卡片的文字会自动更新预估时长。点击'生成画面'预览视觉效果。");
    }
    else if (state.stage === ProjectStage.VISUAL) {
        if (activeSlideId) {
            setIsProcessing(true);
            setMode(AgentMode.CODER);
            await handleGenerateSlideVisual(activeSlideId, text);
            addMessage('assistant', "幻灯片视觉已更新。");
            setIsProcessing(false);
            setMode(AgentMode.IDLE);
        }
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
            // NEW: Script Factory View
            return (
                <ScriptStoryboard 
                    slides={state.slides}
                    activeSlideId={activeSlideId}
                    onSelect={setActiveSlideId}
                    onUpdateSlide={handleSlideUpdate}
                    globalStyle={state.globalStyle}
                    onGenerateVisual={(id) => handleGenerateSlideVisual(id)}
                />
            );

        case ProjectStage.EXPORT:
            return (
                <VideoStage 
                    slides={state.slides}
                    globalStyle={state.globalStyle}
                    onSlideUpdate={handleSlideUpdate}
                />
            );

        case ProjectStage.VISUAL:
        default:
            // Classic View for fine-tuning
            return (
                 <div className="flex h-full">
                    <SlideList 
                        slides={state.slides} 
                        activeId={activeSlideId || ''} 
                        onSelect={setActiveSlideId} 
                    />
                    
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

                    <div className="flex-1 flex flex-col bg-gray-950 relative">
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
      <StageSidebar 
        currentStage={state.stage} 
        onSetStage={(stage) => setState(prev => ({ ...prev, stage }))} 
      />

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
