
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle, ProjectStage, ResearchTopic } from './types';
import StageSidebar from './components/StageSidebar';
import ProjectDashboard from './components/ProjectDashboard';
import ArticleEditor from './components/ArticleEditor';
import PosterEditor from './components/PosterEditor'; // NEW
import ChatInterface from './components/ChatInterface';
import SlidePreview from './components/SlidePreview';
import SlideList from './components/SlideList';
import CodeEditor from './components/CodeEditor';
import ScriptEngine from './components/ScriptEngine'; 
import PresentationRunner from './components/PresentationRunner';
import VideoStage from './components/VideoStage'; 
import ResearchPanel from './components/ResearchPanel'; 
import { generatePresentationOutline, generateSlideHtml, generateTheme } from './services/geminiService';
import { calculateDuration } from './utils/scriptUtils';

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
    stage: ProjectStage.DASHBOARD, // Default to Dashboard (Central Kitchen)
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

  const handleSelectTopic = (topic: ResearchTopic) => {
      setState(prev => ({
          ...prev,
          selectedTopic: topic,
          title: topic.title,
          // We set an initial H1, but rely on the Agent to fill the rest
          sourceMaterial: ``, 
          stage: ProjectStage.STORY 
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
          const scenes = await generatePresentationOutline(state.sourceMaterial);
          if (scenes.length > 0) {
            const newSlides: Slide[] = scenes.map(item => ({
                id: uuidv4(),
                title: item.title,
                visual_intent: item.visual_intent,
                visual_layout: item.visual_layout || 'Cover',
                speaker_notes: item.speaker_notes || '',
                narration: item.narration || '',
                duration: item.duration || calculateDuration(item.narration || ''),
                markers: item.markers || [],
                content_html: '', 
                isGenerated: false,
                isLoading: false
            }));

            setState(prev => ({
                ...prev,
                slides: newSlides,
                stage: ProjectStage.SCRIPT 
            }));
            
            setActiveSlideId(newSlides[0].id);
            addMessage('assistant', `✅ 拆解完成！共生成 ${newSlides.length} 个分镜场景。`);
          }
      } catch (e) {
          addMessage('system', "拆解失败: " + (e as Error).message);
      } finally {
          setIsProcessing(false);
          setMode(AgentMode.IDLE);
      }
  };

  // 2. VISUAL STAGE
  const handleGenerateSlideVisual = async (slideId: string, customInstruction?: string) => {
      const slide = state.slides.find(s => s.id === slideId);
      if (!slide) return;
      handleSlideUpdate(slideId, { isLoading: true });
      try {
        const html = await generateSlideHtml(slide, state.globalStyle, customInstruction);
        handleSlideUpdate(slideId, { content_html: html, isGenerated: true, isLoading: false });
      } catch (e) {
         handleSlideUpdate(slideId, { isLoading: false });
      }
  };

  // 3. CHAT HANDLER
  const handleSendMessage = async (text: string) => {
    addMessage('user', text);
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
    // Existing chat handlers for other stages...
  };

  // --- RENDERERS ---

  const renderMainArea = () => {
    switch (state.stage) {
        case ProjectStage.DASHBOARD:
            return (
                <ProjectDashboard 
                    title={state.title}
                    sourceWordCount={state.sourceMaterial.length}
                    slidesCount={state.slides.length}
                    videoDuration={state.slides.reduce((acc,s) => acc + s.duration, 0)}
                    onNavigate={(stage) => setState(prev => ({ ...prev, stage }))}
                />
            );

        case ProjectStage.RESEARCH:
            return <ResearchPanel onSelectTopic={handleSelectTopic} />;

        case ProjectStage.STORY:
            return (
                <ArticleEditor 
                    content={state.sourceMaterial}
                    onChange={(text) => setState(prev => ({ ...prev, sourceMaterial: text }))}
                    onGenerateScript={handleGenerateScriptFromArticle}
                    isProcessing={isProcessing}
                    topic={state.selectedTopic} // Pass the full topic context
                />
            );
        
        case ProjectStage.POSTER: // NEW
            return (
                <PosterEditor 
                    sourceMaterial={state.sourceMaterial}
                    projectTitle={state.title}
                    globalStyle={state.globalStyle}
                />
            );

        case ProjectStage.SCRIPT:
            // USE NEW ENGINE WRAPPER
            return (
                <ScriptEngine 
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
                    onAddSlide={() => {
                         const newSlide = { id: uuidv4(), title: 'New Scene', visual_intent: '...', visual_layout: 'Cover', narration: '', duration: 5, markers: [], content_html: '', isGenerated: false, isLoading: false, speaker_notes: '' } as Slide;
                         setState(prev => ({...prev, slides: [...prev.slides, newSlide]}));
                    }}
                    onDeleteSlide={(id) => setState(prev => ({...prev, slides: prev.slides.filter(s => s.id !== id)}))}
                    onDuplicateSlide={(id) => { /* dup logic */ }}
                    onMoveSlide={(id, dir) => { /* move logic */ }}
                    onSplitSlide={(id, off) => { /* split logic */ }}
                />
            );

        case ProjectStage.VISUAL:
        default:
            return (
                 <div className="flex h-full">
                    <SlideList slides={state.slides} activeId={activeSlideId || ''} onSelect={setActiveSlideId} />
                    <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900 border-l border-gray-800">
                         <div className={`flex-1 overflow-hidden flex flex-col ${editorMode === 'code' ? 'h-1/2' : 'h-full'}`}>
                             <ChatInterface messages={messages} onSendMessage={handleSendMessage} isProcessing={isProcessing} mode={mode} />
                         </div>
                         {activeSlide && editorMode === 'code' && (
                            <div className="h-1/2 flex-1 border-t border-gray-800">
                                <CodeEditor slide={activeSlide} onSave={(id, html) => handleSlideUpdate(id, { content_html: html })} />
                            </div>
                         )}
                    </div>
                    <div className="flex-1 flex flex-col bg-gray-950 relative">
                        <div className="h-12 border-b border-gray-800 flex items-center justify-center px-4 bg-gray-900">
                            <h1 className="font-bold text-gray-300 text-sm">{state.title}</h1>
                            <div className="flex gap-2 absolute right-4">
                                <button onClick={() => setIsPresenting(true)} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500">
                                    <i className="fa-solid fa-play mr-2"></i> 演示
                                </button>
                                <button onClick={() => setEditorMode(editorMode === 'code' ? 'none' : 'code')} className={`text-xs px-3 py-1.5 rounded border ${editorMode === 'code' ? 'bg-blue-900 border-blue-500' : 'border-gray-700'}`}>
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
      <StageSidebar currentStage={state.stage} onSetStage={(stage) => setState(prev => ({ ...prev, stage }))} />
      <div className="flex-1 h-full overflow-hidden relative">{renderMainArea()}</div>
      {isPresenting && <PresentationRunner slides={state.slides} globalStyle={state.globalStyle} onClose={() => setIsPresenting(false)} />}
    </div>
  );
};
export default App;
