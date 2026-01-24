
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PresentationState, Slide, ChatMessage, AgentMode, GlobalStyle, ProjectStage, ResearchTopic } from './types';
import StageSidebar from './components/StageSidebar';
import ProjectDashboard from './components/ProjectDashboard';
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
import GlobalSettingsModal from './components/GlobalSettingsModal'; 
import { generatePresentationOutline, generateSlideHtml, generateTheme } from './services/geminiService';
import { calculateDuration } from './utils/scriptUtils';

const DEFAULT_STYLE: GlobalStyle = {
  themeName: 'SpaceDark',
  mainColor: '#111827',
  accentColor: '#3b82f6',
  fontFamily: 'Inter, sans-serif'
};

const App: React.FC = () => {
  // --- API KEY CHECK ---
  const apiKey = process.env.API_KEY;
  const provider = (process.env.AI_PROVIDER || 'gemini') as 'gemini' | 'deepseek' | 'glm';
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    const providerInfo = {
      gemini: { name: 'Google Gemini', url: 'https://ai.google.dev/', keyFormat: 'AIzaSy...' },
      deepseek: { name: 'DeepSeek', url: 'https://platform.deepseek.com/', keyFormat: 'sk-...' },
      glm: { name: 'GLM (智谱)', url: 'https://open.bigmodel.cn/', keyFormat: 'xxx.xxx' }
    };
    
    const info = providerInfo[provider];
    
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-950 text-white">
        <div className="max-w-2xl p-8 bg-gray-900 rounded-xl border border-red-500/50 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <i className="fa-solid fa-triangle-exclamation text-red-500 text-3xl"></i>
            <h1 className="text-2xl font-bold text-red-400">缺少 {info.name} API Key</h1>
          </div>
          <p className="text-gray-300 mb-4">
            当前配置使用 <span className="text-blue-400 font-bold">{info.name}</span> 服务，请按以下步骤配置：
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-400 mb-6">
            <li>访问 <a href={info.url} target="_blank" className="text-blue-400 hover:underline">{info.name} 官网</a> 获取 API Key</li>
            <li>在项目根目录找到 <code className="bg-gray-800 px-2 py-1 rounded text-yellow-400">.env.local</code> 文件</li>
            <li>取消注释对应服务商的配置行</li>
            <li>将 <code className="bg-gray-800 px-2 py-1 rounded">your_api_key_here</code> 替换为你的真实 API Key</li>
            <li>保存文件后刷新页面</li>
          </ol>
          <div className="bg-gray-800 p-4 rounded font-mono text-sm text-green-400 mb-4">
            AI_PROVIDER={provider}<br/>
            {provider === 'gemini' && `GEMINI_API_KEY=${info.keyFormat}`}
            {provider === 'deepseek' && `DEEPSEEK_API_KEY=${info.keyFormat}`}
            {provider === 'glm' && `GLM_API_KEY=${info.keyFormat}`}
          </div>
          <div className="bg-blue-900/20 border border-blue-500/30 rounded p-3 text-sm text-blue-300">
            <i className="fa-solid fa-lightbulb mr-2"></i>
            <strong>提示：</strong>支持切换服务商！修改 <code className="bg-gray-800 px-1.5 py-0.5 rounded">AI_PROVIDER</code> 为 gemini / deepseek / glm
          </div>
        </div>
      </div>
    );
  }

  // --- GLOBAL STATE ---
  const [state, setState] = useState<PresentationState>({
    projectId: uuidv4(),
    title: '未命名项目',
    stage: ProjectStage.DASHBOARD, 
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
  const [showGlobalSettings, setShowGlobalSettings] = useState(false); 

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
          sourceMaterial: ``, 
          stage: ProjectStage.STORY 
      }));
  };

  // --- ACTIONS ---
  
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
                    topic={state.selectedTopic} 
                />
            );
        
        case ProjectStage.POSTER: 
            return (
                <PosterEditor 
                    sourceMaterial={state.sourceMaterial}
                    projectTitle={state.title}
                    globalStyle={state.globalStyle}
                />
            );

        case ProjectStage.SCRIPT:
            return (
                <ScriptEngine 
                    slides={state.slides}
                    activeSlideId={activeSlideId}
                    onSelect={setActiveSlideId}
                    onUpdateSlide={handleSlideUpdate}
                    globalStyle={state.globalStyle}
                    onGenerateVisual={(id) => handleGenerateSlideVisual(id)}
                    
                    // --- CRUD Handlers for Synthesis Board (VideoStage) ---
                    onAddSlide={() => {
                         const newSlide = { id: uuidv4(), title: 'New Scene', visual_intent: '...', visual_layout: 'Cover', narration: '', duration: 5, markers: [], content_html: '', isGenerated: false, isLoading: false, speaker_notes: '' } as Slide;
                         setState(prev => ({...prev, slides: [...prev.slides, newSlide]}));
                    }}
                    onDeleteSlide={(id) => setState(prev => ({...prev, slides: prev.slides.filter(s => s.id !== id)}))}
                    onDuplicateSlide={(id) => {
                        const slide = state.slides.find(s => s.id === id);
                        if (slide) {
                             const newSlide = { ...slide, id: uuidv4(), title: `${slide.title} (Copy)` };
                             const idx = state.slides.findIndex(s => s.id === id);
                             const newSlides = [...state.slides];
                             newSlides.splice(idx + 1, 0, newSlide);
                             setState(prev => ({...prev, slides: newSlides}));
                        }
                    }}
                    onMoveSlide={(id, dir) => { 
                        const idx = state.slides.findIndex(s => s.id === id);
                        if (idx === -1) return;
                        const newIdx = idx + dir;
                        if (newIdx < 0 || newIdx >= state.slides.length) return;
                        const newSlides = [...state.slides];
                        [newSlides[idx], newSlides[newIdx]] = [newSlides[newIdx], newSlides[idx]];
                        setState(prev => ({...prev, slides: newSlides}));
                    }}
                    onSplitSlide={(id, off) => { /* split logic placeholder */ }}
                />
            );

        case ProjectStage.EXPORT:
            // Keeping for backward compatibility or direct access, but essentially merged into SCRIPT
            return (
                <VideoStage 
                    slides={state.slides}
                    globalStyle={state.globalStyle}
                    onSlideUpdate={handleSlideUpdate}
                    onAddSlide={() => {}}
                    onDeleteSlide={() => {}}
                    onDuplicateSlide={() => {}}
                    onMoveSlide={() => {}}
                    onSplitSlide={() => {}}
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
      <StageSidebar 
        currentStage={state.stage} 
        onSetStage={(stage) => setState(prev => ({ ...prev, stage }))} 
        onOpenSettings={() => setShowGlobalSettings(true)} 
      />
      <div className="flex-1 h-full overflow-hidden relative">{renderMainArea()}</div>
      
      {isPresenting && <PresentationRunner slides={state.slides} globalStyle={state.globalStyle} onClose={() => setIsPresenting(false)} />}
      
      {/* Global Settings Modal */}
      <GlobalSettingsModal isOpen={showGlobalSettings} onClose={() => setShowGlobalSettings(false)} />
    </div>
  );
};
export default App;
