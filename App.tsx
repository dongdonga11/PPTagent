
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle, AppMode, Article, ResearchTopic } from './types';
import StageSidebar from './components/StageSidebar';
import ArticleLibrary from './components/ArticleLibrary';
import ArticleEditor from './components/ArticleEditor';
import PosterEditor from './components/PosterEditor'; 
import ChatInterface from './components/ChatInterface';
import SlidePreview from './components/SlidePreview';
import SlideList from './components/SlideList';
import CodeEditor from './components/CodeEditor';
import ScriptEngine from './components/ScriptEngine'; 
import PresentationRunner from './components/PresentationRunner';
import VideoStage from './components/VideoStage'; 
import ResearchPanel from './components/ResearchPanel';
import { pptAgentChat, generateSlideHtml, generateTheme } from './services/geminiService'; // CHANGED: use pptAgentChat
import { calculateDuration } from './utils/scriptUtils';

const DEFAULT_STYLE: GlobalStyle = {
  themeName: 'SpaceDark',
  mainColor: '#111827',
  accentColor: '#3b82f6',
  fontFamily: 'Inter, sans-serif'
};

const INITIAL_ARTICLES: Article[] = [
    {
        id: 'sample-1',
        title: 'SpaceCoding 2.0 发布说明',
        content: '<p>欢迎来到全新的 SpaceCoding 内容工坊...</p>',
        plainText: '欢迎来到全新的 SpaceCoding 内容工坊...',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ['发布', '指南'],
        author: 'Admin'
    }
];

const App: React.FC = () => {
  // --- GLOBAL STATE ---
  const [state, setState] = useState<PresentationState>({
    mode: AppMode.HOME,
    activeModuleId: 'init',
    savedArticles: INITIAL_ARTICLES,
    projectId: uuidv4(),
    title: '未命名项目',
    sourceMaterial: '',
    slides: [],
    globalStyle: DEFAULT_STYLE,
    showResearchPanel: false
  });
  
  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editorMode, setEditorMode] = useState<'code' | 'script' | 'none'>('none');
  const [agentMode, setAgentMode] = useState<AgentMode>(AgentMode.IDLE);
  const [isPresenting, setIsPresenting] = useState(false);
  const [showArticlePicker, setShowArticlePicker] = useState(false);

  const activeSlide = state.slides.find(s => s.id === activeSlideId) || null;

  // --- ACTIONS: LIBRARY MANAGEMENT ---
  const handleCreateArticle = () => {
      setState(prev => ({ ...prev, mode: AppMode.ARTICLE, currentArticleId: undefined, sourceMaterial: '', title: '新建文章' }));
  };

  const handleEditArticle = (article: Article) => {
      setState(prev => ({ ...prev, mode: AppMode.ARTICLE, currentArticleId: article.id, sourceMaterial: article.content, title: article.title }));
  };

  const handleSaveArticle = (title: string, content: string, plainText: string) => {
      const now = Date.now();
      setState(prev => {
          let updatedArticles = [...prev.savedArticles];
          if (prev.currentArticleId) {
              updatedArticles = updatedArticles.map(a => a.id === prev.currentArticleId ? { ...a, title, content, plainText, updatedAt: now } : a);
          } else {
              const newId = uuidv4();
              updatedArticles.unshift({ id: newId, title, content, plainText, createdAt: now, updatedAt: now, tags: ['Draft'], author: 'User' });
              return { ...prev, savedArticles: updatedArticles, currentArticleId: newId, title };
          }
          return { ...prev, savedArticles: updatedArticles, title };
      });
      alert('文章已保存到媒体库');
  };

  const handleDeleteArticle = (id: string) => {
      setState(prev => ({ ...prev, savedArticles: prev.savedArticles.filter(a => a.id !== id) }));
  };

  const handleDerive = (article: Article, targetMode: AppMode) => {
      // 1. Switch Mode
      setState(prev => ({
          ...prev,
          mode: targetMode,
          sourceMaterial: article.plainText, // Use plain text for AI context
          title: `${article.title}`,
          slides: [], 
          currentArticleId: article.id
      }));
      setShowArticlePicker(false);
      setMessages([]); // Clear chat for new session

      // 2. Trigger "Kickstart" conversation if it's PPT mode
      if (targetMode === AppMode.PRESENTATION) {
          setTimeout(() => {
              addMessage('system', `已装载文章数据：${article.title} (${article.plainText.length}字)`);
              addMessage('assistant', `👋 你好！我是 SpaceCoding 演示架构师。\n\n我已阅读了《${article.title}》。\n\n请问您希望这份 PPT 呈现什么**风格**？\n(例如：科技深色、极简白、赛博朋克、学术严谨...)`);
          }, 500);
      }
  };

  const handleModeSwitch = (newMode: AppMode) => {
      if (newMode === AppMode.HOME) {
          setState(prev => ({ ...prev, mode: newMode }));
      } else {
          setState(prev => ({ ...prev, mode: newMode, sourceMaterial: '', slides: [], title: '未命名项目' }));
          setShowArticlePicker(false); 
          setMessages([]);
      }
  };

  // --- ACTIONS: PPT GENERATION FLOW ---

  // NOTE: This function is now only used when manually clicking "Import" from inside the PPT view
  const handleImportArticleForPPT = (article: Article) => {
      setState(prev => ({
          ...prev,
          sourceMaterial: article.plainText,
          title: article.title,
          slides: []
      }));
      setMessages([]);
      addMessage('system', `已导入文章：${article.title}`);
      addMessage('assistant', `👋 收到。我是 SpaceCoding 演示架构师。\n\n请告诉我，这份 PPT 您想走什么**设计风格**？\n(例如：高端商务、酷炫科技、清新教育...)`);
  };

  const handleSlideUpdate = (id: string, updates: Partial<Slide>) => {
      setState(prev => ({
          ...prev,
          slides: prev.slides.map(s => s.id === id ? { ...s, ...updates } : s)
      }));
  };

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

  // --- CHAT LOGIC (THE BRAIN) ---
  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    setMessages(prev => [...prev, { id: uuidv4(), role, content, timestamp: Date.now() }]);
  };
  
  const handleSendMessage = async (text: string) => {
    addMessage('user', text);
    setIsProcessing(true);

    try {
        // If in Presentation Mode, use the Conversational Agent
        if (state.mode === AppMode.PRESENTATION) {
            setAgentMode(AgentMode.PLANNER);
            
            // Call the Smart Agent
            const response = await pptAgentChat(messages, text, state.sourceMaterial, state.title);
            
            // 1. Show the Agent's textual reply
            if (response.reply) {
                addMessage('assistant', response.reply);
            }

            // 2. Execute Actions
            if (response.action) {
                if (response.action.type === 'update_style') {
                    // Update Theme
                    setState(prev => ({ ...prev, globalStyle: response.action.data }));
                    // addMessage('system', `🎨 主题已设定: ${response.action.data.themeName}`);
                }
                else if (response.action.type === 'generate_outline') {
                    // Just showing the outline in chat is handled by the 'reply' usually, 
                    // but if we wanted to render a specific UI component, we could do it here.
                    // For now, the agent returns the outline as text in 'reply'.
                }
                else if (response.action.type === 'create_slides') {
                    // THE BIG MOMENT: Create Slides from JSON
                    const slidesData = response.action.data;
                    const newSlides: Slide[] = slidesData.map((item: any) => ({
                        id: uuidv4(),
                        title: item.title,
                        visual_intent: item.visual_intent,
                        visual_layout: item.visual_layout || 'Cover',
                        speaker_notes: item.speaker_notes || '',
                        narration: item.narration || '',
                        duration: item.duration || calculateDuration(item.narration || ''),
                        markers: [],
                        content_html: '', 
                        isGenerated: false,
                        isLoading: false
                    }));
                    
                    setState(prev => ({ ...prev, slides: newSlides }));
                    setActiveSlideId(newSlides[0].id);
                    
                    // Auto-start the first slide visual generation
                    handleGenerateSlideVisual(newSlides[0].id);
                }
            }

        } else {
            // Fallback for other modes (simple echo or specific logic)
             if (text.toLowerCase().includes('color')) {
                const newTheme = await generateTheme(text);
                setState(prev => ({ ...prev, globalStyle: newTheme }));
                addMessage('assistant', `主题已更新：${newTheme.themeName}`);
            } else {
                addMessage('assistant', "收到指令。但在当前模式下，我仅支持基础指令。");
            }
        }
    } catch (e) {
        addMessage('system', "Agent Error: " + (e as Error).message);
    } finally {
        setIsProcessing(false);
        setAgentMode(AgentMode.IDLE);
    }
  };

  // --- RENDERERS ---

  const renderModule = () => {
    switch (state.mode) {
        case AppMode.HOME:
            return (
                <ArticleLibrary 
                    articles={state.savedArticles}
                    onEdit={handleEditArticle}
                    onDelete={handleDeleteArticle}
                    onCreateNew={handleCreateArticle}
                    onDerive={handleDerive}
                />
            );
        
        case AppMode.RESEARCH:
            return <ResearchPanel onSelectTopic={(t) => {/* handle logic */}} />;

        case AppMode.ARTICLE:
            return (
                <ArticleEditor 
                    article={state.savedArticles.find(a => a.id === state.currentArticleId)}
                    onSave={handleSaveArticle}
                    onBack={() => setState(prev => ({...prev, mode: AppMode.HOME}))}
                />
            );
        
        case AppMode.POSTER:
            return (
                <PosterEditor 
                    sourceMaterial={state.sourceMaterial}
                    projectTitle={state.title}
                    globalStyle={state.globalStyle}
                />
            );

        case AppMode.VIDEO:
            return (
                <div className="flex flex-col h-full">
                     <div className="h-10 bg-[#111] flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
                        <span className="text-xs text-gray-500">{state.title}</span>
                     </div>
                    <ScriptEngine 
                        slides={state.slides}
                        activeSlideId={activeSlideId}
                        onSelect={setActiveSlideId}
                        onUpdateSlide={handleSlideUpdate}
                        globalStyle={state.globalStyle}
                        onGenerateVisual={(id) => handleGenerateSlideVisual(id)}
                    />
                    <div className="h-1/2 border-t border-gray-800">
                        <VideoStage 
                            slides={state.slides}
                            globalStyle={state.globalStyle}
                            onSlideUpdate={handleSlideUpdate}
                            onAddSlide={() => {/*...*/}}
                            onDeleteSlide={() => {/*...*/}}
                            onDuplicateSlide={() => {/*...*/}}
                            onMoveSlide={() => {/*...*/}}
                            onSplitSlide={() => {/*...*/}}
                        />
                    </div>
                </div>
            );

        case AppMode.PRESENTATION:
        default:
            return (
                 <div className="flex h-full w-full overflow-hidden">
                    {/* LEFT SIDEBAR: SLIDES LIST */}
                    <SlideList slides={state.slides} activeId={activeSlideId || ''} onSelect={setActiveSlideId} />
                    
                    {/* MIDDLE: CHAT + CODE (The "IDE" part) */}
                    <div className="w-96 flex flex-col border-r border-gray-800 bg-gray-900 border-l border-gray-800 shrink-0">
                         {/* Chat Interface takes full height unless Code Editor is open */}
                         <div className={`flex-1 flex flex-col min-h-0 ${editorMode === 'code' ? 'h-1/2' : 'h-full'}`}>
                             <ChatInterface 
                                messages={messages} 
                                onSendMessage={handleSendMessage} 
                                isProcessing={isProcessing} 
                                mode={agentMode} 
                             />
                         </div>
                         {activeSlide && editorMode === 'code' && (
                            <div className="h-1/2 flex-1 border-t border-gray-800 min-h-0">
                                <CodeEditor slide={activeSlide} onSave={(id, html) => handleSlideUpdate(id, { content_html: html })} />
                            </div>
                         )}
                    </div>

                    {/* RIGHT: PREVIEW STAGE */}
                    <div className="flex-1 flex flex-col bg-gray-950 relative min-w-0">
                        <div className="h-12 border-b border-gray-800 flex items-center justify-center px-4 bg-gray-900 shrink-0">
                             <div className="absolute left-4 flex items-center gap-2">
                                <button onClick={() => setShowArticlePicker(true)} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 hover:text-white border border-gray-700">
                                    <i className="fa-solid fa-file-import"></i> 导入文章
                                </button>
                             </div>
                            <h1 className="font-bold text-gray-300 text-sm truncate max-w-[300px]">{state.title}</h1>
                            <div className="flex gap-2 absolute right-4">
                                <button onClick={() => setIsPresenting(true)} className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-500">
                                    <i className="fa-solid fa-play mr-2"></i> 演示
                                </button>
                                <button onClick={() => setEditorMode(editorMode === 'code' ? 'none' : 'code')} className={`text-xs px-3 py-1.5 rounded border ${editorMode === 'code' ? 'bg-blue-900 border-blue-500' : 'border-gray-700'}`}>
                                    <i className="fa-solid fa-code"></i>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-8 bg-black/50 flex items-center justify-center overflow-hidden">
                            <SlidePreview slide={activeSlide} globalStyle={state.globalStyle} />
                        </div>
                    </div>
                 </div>
            );
    }
  };

  // --- MODAL: ARTICLE PICKER ---
  const renderArticlePicker = () => {
      if (!showArticlePicker) return null;
      return (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8">
              <div className="bg-[#1a1a1a] w-full max-w-3xl rounded-xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">
                  <div className="p-6 border-b border-gray-700 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-white">选择文章源 (Select Source)</h3>
                      <button onClick={() => setShowArticlePicker(false)} className="text-gray-400 hover:text-white"><i className="fa-solid fa-xmark"></i></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
                      {state.savedArticles.map(article => (
                          <div 
                            key={article.id} 
                            onClick={() => {
                                setShowArticlePicker(false);
                                handleImportArticleForPPT(article);
                            }}
                            className="bg-[#222] p-4 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer hover:bg-[#2a2a2a] transition-all group"
                          >
                              <h4 className="font-bold text-gray-200 mb-2 group-hover:text-blue-400">{article.title}</h4>
                              <p className="text-xs text-gray-500 line-clamp-3">{article.plainText}</p>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )
  }

  return (
    <div className="flex h-screen w-screen text-gray-100 font-sans overflow-hidden bg-black">
      <StageSidebar currentMode={state.mode} onSetMode={handleModeSwitch} />
      <div className="flex-1 h-full overflow-hidden relative">
        {renderModule()}
      </div>
      {renderArticlePicker()}
      {isPresenting && <PresentationRunner slides={state.slides} globalStyle={state.globalStyle} onClose={() => setIsPresenting(false)} />}
    </div>
  );
};
export default App;
