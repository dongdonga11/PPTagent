
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle, AppMode, Article, ResearchTopic } from './types';
import StageSidebar from './components/StageSidebar';
import ArticleLibrary from './components/ArticleLibrary'; // New Home
import ArticleEditor from './components/ArticleEditor'; // Writer Module
import PosterEditor from './components/PosterEditor'; 
import ChatInterface from './components/ChatInterface';
import SlidePreview from './components/SlidePreview';
import SlideList from './components/SlideList';
import CodeEditor from './components/CodeEditor';
import ScriptEngine from './components/ScriptEngine'; 
import PresentationRunner from './components/PresentationRunner';
import VideoStage from './components/VideoStage'; 
import ResearchPanel from './components/ResearchPanel'; // Top level module now
import { generatePresentationOutline, generateSlideHtml, generateTheme } from './services/geminiService';
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
  const [showArticlePicker, setShowArticlePicker] = useState(false); // Modal for selecting source

  const activeSlide = state.slides.find(s => s.id === activeSlideId) || null;

  // --- ACTIONS: LIBRARY MANAGEMENT ---

  const handleCreateArticle = () => {
      setState(prev => ({
          ...prev,
          mode: AppMode.ARTICLE,
          currentArticleId: undefined,
          sourceMaterial: '',
          title: '新建文章'
      }));
  };

  const handleEditArticle = (article: Article) => {
      setState(prev => ({
          ...prev,
          mode: AppMode.ARTICLE,
          currentArticleId: article.id,
          sourceMaterial: article.content,
          title: article.title
      }));
  };

  const handleSaveArticle = (title: string, content: string, plainText: string) => {
      const now = Date.now();
      setState(prev => {
          let updatedArticles = [...prev.savedArticles];
          if (prev.currentArticleId) {
              // Update existing
              updatedArticles = updatedArticles.map(a => a.id === prev.currentArticleId ? {
                  ...a, title, content, plainText, updatedAt: now
              } : a);
          } else {
              // Create new
              const newId = uuidv4();
              updatedArticles.unshift({
                  id: newId,
                  title,
                  content,
                  plainText,
                  createdAt: now,
                  updatedAt: now,
                  tags: ['Draft'],
                  author: 'User'
              });
              // Stay in edit mode for the new article
              return { ...prev, savedArticles: updatedArticles, currentArticleId: newId, title };
          }
          return { ...prev, savedArticles: updatedArticles, title };
      });
      alert('文章已保存到媒体库');
  };

  const handleDeleteArticle = (id: string) => {
      setState(prev => ({
          ...prev,
          savedArticles: prev.savedArticles.filter(a => a.id !== id)
      }));
  };

  const handleDerive = (article: Article, targetMode: AppMode) => {
      setState(prev => ({
          ...prev,
          mode: targetMode,
          sourceMaterial: article.content, // Should ideally be plain text for generation, but we pass full context
          title: `${article.title} - ${targetMode === AppMode.VIDEO ? '视频版' : targetMode === AppMode.POSTER ? '海报' : 'PPT'}`,
          slides: [], // Reset slides for new project
          currentArticleId: article.id // Link back
      }));
      setShowArticlePicker(false);
  };

  const handleModeSwitch = (newMode: AppMode) => {
      if (newMode === AppMode.HOME) {
          setState(prev => ({ ...prev, mode: newMode }));
      } else {
          // Switch mode and reset project state for a fresh start
          setState(prev => ({ 
              ...prev, 
              mode: newMode,
              sourceMaterial: '',
              slides: [],
              title: '未命名项目'
          }));
          
          // Do NOT auto-open picker. Let the specific module UI handle the "Empty State" choice.
          setShowArticlePicker(false); 
      }
  };

  const handleSelectTopic = (topic: ResearchTopic) => {
      // Flow: Select Topic -> Create New Article Draft -> Go to Article Editor
      const newArticleId = uuidv4();
      const now = Date.now();
      const newArticle: Article = {
          id: newArticleId,
          title: topic.title,
          content: `<p>${topic.coreViewpoint}</p><p>(基于热点生成，热度：${topic.hotScore})</p>`,
          plainText: topic.coreViewpoint,
          createdAt: now,
          updatedAt: now,
          tags: ['Hotspot', 'Draft'],
          author: 'AI Researcher'
      };

      setState(prev => ({
          ...prev,
          savedArticles: [newArticle, ...prev.savedArticles],
          mode: AppMode.ARTICLE,
          currentArticleId: newArticleId,
          sourceMaterial: newArticle.content,
          title: newArticle.title
      }));
  };

  // --- ACTIONS: GENERATION ---

  const handleGenerateScriptFromArticle = async (contentOverride?: string, articleTitle?: string) => {
      const contentToUse = contentOverride || state.sourceMaterial;
      if (!contentToUse?.trim()) return;
      
      setIsProcessing(true);
      setAgentMode(AgentMode.PLANNER);
      
      // Send Feedback to Chat Interface instead of blocking UI
      if (articleTitle) {
          addMessage('system', `已选择文章：«${articleTitle}»`);
          addMessage('assistant', `正在阅读文章并规划演示大纲，请稍候...`);
      } else {
          addMessage('user', "正在启动脚本工厂，拆解分镜中...");
      }
      
      try {
          const scenes = await generatePresentationOutline(contentToUse);
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
            }));
            
            setActiveSlideId(newSlides[0].id);
            addMessage('assistant', `✅ 拆解完成！共生成 ${newSlides.length} 个分镜场景。`);
          }
      } catch (e) {
          addMessage('system', "拆解失败: " + (e as Error).message);
      } finally {
          setIsProcessing(false);
          setAgentMode(AgentMode.IDLE);
      }
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

  // --- CHAT HELPERS ---
  const addMessage = (role: 'user' | 'assistant' | 'system', content: string) => {
    setMessages(prev => [...prev, { id: uuidv4(), role, content, timestamp: Date.now() }]);
  };
  
  const handleSendMessage = async (text: string) => {
    addMessage('user', text);
    if (text.toLowerCase().includes('color') || text.includes('颜色') || text.includes('风格')) {
        setIsProcessing(true);
        setAgentMode(AgentMode.DESIGNER);
        const newTheme = await generateTheme(text);
        setState(prev => ({ ...prev, globalStyle: newTheme }));
        addMessage('assistant', `主题已更新：${newTheme.themeName}`);
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
            return <ResearchPanel onSelectTopic={handleSelectTopic} />;

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
                     {/* Mini Header for Video */}
                     <div className="h-10 bg-[#111] flex items-center justify-between px-4 border-b border-gray-800 shrink-0">
                        <div className="flex items-center gap-2 text-gray-400 text-xs">
                             <button onClick={() => setShowArticlePicker(true)} className="hover:text-white"><i className="fa-solid fa-file-import mr-1"></i> 导入文章</button>
                             <span>|</span>
                             <button onClick={() => handleGenerateScriptFromArticle()} className="hover:text-white"><i className="fa-solid fa-wand-magic-sparkles mr-1"></i> AI 生成脚本</button>
                        </div>
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
                            onAddSlide={() => {
                                const newSlide = { id: uuidv4(), title: 'New Scene', visual_intent: '...', visual_layout: 'Cover', narration: '', duration: 5, markers: [], content_html: '', isGenerated: false, isLoading: false, speaker_notes: '' } as Slide;
                                setState(prev => ({...prev, slides: [...prev.slides, newSlide]}));
                            }}
                            onDeleteSlide={(id) => setState(prev => ({...prev, slides: prev.slides.filter(s => s.id !== id)}))}
                            onDuplicateSlide={(id) => { /* dup logic */ }}
                            onMoveSlide={(id, dir) => { /* move logic */ }}
                            onSplitSlide={(id, off) => { /* split logic */ }}
                        />
                    </div>
                </div>
            );

        case AppMode.PRESENTATION:
        default:
            return (
                 <div className="flex h-full">
                    {/* Floating Import Button if empty AND NOT PROCESSING. 
                        If processing, we hide this so the editor UI (Chat, etc.) is visible.
                    */}
                    {state.slides.length === 0 && !isProcessing && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="bg-[#1a1a1a] p-8 rounded-xl border border-gray-800 shadow-2xl text-center max-w-md animate-in zoom-in-95 duration-300">
                                <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
                                    <i className="fa-solid fa-person-chalkboard text-2xl text-blue-400"></i>
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">新建演示文稿</h2>
                                <p className="text-gray-400 text-sm mb-6 leading-relaxed">您可以从现有的文章库导入内容，让 AI 自动生成大纲，或者从空白页开始。</p>
                                <div className="flex gap-4 justify-center">
                                    <button 
                                        onClick={() => setShowArticlePicker(true)}
                                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:shadow-blue-500/20 transition-all flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-file-import"></i> 从文章导入
                                    </button>
                                    <button 
                                        onClick={() => {
                                                const newSlide = { id: uuidv4(), title: '封面', visual_intent: '标题页', visual_layout: 'Cover', narration: '', duration: 5, markers: [], content_html: '', isGenerated: false, isLoading: false, speaker_notes: '' } as Slide;
                                                setState(prev => ({...prev, slides: [newSlide]}));
                                        }}
                                        className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-5 py-2.5 rounded-lg border border-gray-700 hover:border-gray-600 transition-all"
                                    >
                                        从空白开始
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <SlideList slides={state.slides} activeId={activeSlideId || ''} onSelect={setActiveSlideId} />
                    <div className="w-80 flex flex-col border-r border-gray-800 bg-gray-900 border-l border-gray-800">
                         <div className={`flex-1 overflow-hidden flex flex-col ${editorMode === 'code' ? 'h-1/2' : 'h-full'}`}>
                             <ChatInterface messages={messages} onSendMessage={handleSendMessage} isProcessing={isProcessing} mode={agentMode} />
                         </div>
                         {activeSlide && editorMode === 'code' && (
                            <div className="h-1/2 flex-1 border-t border-gray-800">
                                <CodeEditor slide={activeSlide} onSave={(id, html) => handleSlideUpdate(id, { content_html: html })} />
                            </div>
                         )}
                    </div>
                    <div className="flex-1 flex flex-col bg-gray-950 relative">
                        <div className="h-12 border-b border-gray-800 flex items-center justify-center px-4 bg-gray-900">
                             <div className="absolute left-4 flex items-center gap-2">
                                <button onClick={() => setShowArticlePicker(true)} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 hover:text-white border border-gray-700">
                                    <i className="fa-solid fa-file-import"></i> 更换文章源
                                </button>
                                <button onClick={() => handleGenerateScriptFromArticle()} className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 hover:text-white border border-gray-700" title="基于当前文章生成Slide">
                                    <i className="fa-solid fa-wand-magic-sparkles"></i> AI 生成分镜
                                </button>
                             </div>
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
                                // 1. Set State
                                setState(prev => ({
                                    ...prev,
                                    sourceMaterial: article.content, // Load content
                                    title: article.title + ' (Derived)',
                                    slides: [] // Reset slides to trigger empty state logic if needed
                                }));
                                // 2. Close Picker
                                setShowArticlePicker(false);
                                
                                // 3. TRIGGER GENERATION IMMEDIATELY (Pass Title for Chat Feedback)
                                handleGenerateScriptFromArticle(article.content, article.title);
                            }}
                            className="bg-[#222] p-4 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer hover:bg-[#2a2a2a] transition-all group"
                          >
                              <h4 className="font-bold text-gray-200 mb-2 group-hover:text-blue-400">{article.title}</h4>
                              <p className="text-xs text-gray-500 line-clamp-3">{article.plainText}</p>
                              <div className="mt-3 flex gap-2">
                                  {article.tags.map(t => <span key={t} className="text-[9px] bg-black/50 px-2 py-0.5 rounded text-gray-400">{t}</span>)}
                              </div>
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
