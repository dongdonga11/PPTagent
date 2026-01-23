
export type SlideLayoutType = 'Cover' | 'SectionTitle' | 'Bullets' | 'SplitLeft' | 'SplitRight' | 'BigNumber' | 'Quote' | 'GridFeatures';

export interface AnimationMarker {
  id: number;       // 1, 2, 3... corresponding to [M:1], [M:2]
  time: number;     // relative time in seconds from start of slide
  label?: string;   // optional description
}

export interface Slide {
  id: string;
  title: string;
  visual_intent: string; 
  visual_layout: SlideLayoutType; 
  content_html: string; 
  narration: string; 
  duration: number; 
  speaker_notes: string;
  audioData?: string; 
  markers: AnimationMarker[]; 
  isGenerated: boolean;
  isLoading: boolean;
}

export interface GlobalStyle {
  themeName: string;
  mainColor: string;
  accentColor: string;
  fontFamily: string;
}

// --- CMS & DATA TYPES ---

export interface Article {
    id: string;
    title: string;
    content: string; // The full HTML content
    plainText: string; // For searching/AI processing
    createdAt: number;
    updatedAt: number;
    tags: string[];
    author: string;
}

export interface UserStyleProfile {
    id: string;
    name: string;
    tone: string; 
    forbiddenWords: string[];
    preferredEnding: string;
    colorScheme: {
        primary: string;
        secondary: string;
    };
}

export interface ResearchTopic {
    id: string;
    title: string;
    coreViewpoint: string;
    hotScore: number; 
    source?: string;
}

// THE NEW MODULAR NAVIGATION ENUM
export enum AppMode {
  HOME = 'HOME',           // 1. Media Hub
  RESEARCH = 'RESEARCH',   // 2. Hotspots (New Independent Module)
  ARTICLE = 'ARTICLE',     // 3. Article Writer (Renamed from WRITER)
  PRESENTATION = 'PRESENTATION', // 4. PPT
  VIDEO = 'VIDEO',         // 5. Video
  POSTER = 'POSTER'        // 6. Poster
}

export enum ProjectStage {
    STORY = 'STORY',
    SCRIPT = 'SCRIPT',
    VISUAL = 'VISUAL',
    POSTER = 'POSTER',
    RESEARCH = 'RESEARCH'
}

export interface PresentationState {
  // App Logic State
  mode: AppMode;
  activeModuleId: string; // To track different sessions
  
  // Data State
  savedArticles: Article[]; // The "Database"
  
  // Current Working Session State
  currentArticleId?: string; // If working on an existing article
  projectTitle: string;
  sourceMaterial: string; // The active text input for AI
  slides: Slide[];
  globalStyle: GlobalStyle;
  
  // Sub-states
  userProfile?: UserStyleProfile;
  selectedTopic?: ResearchTopic;
  
  // UI States
  showResearchPanel: boolean; // Toggle inside Writer
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// --- CMS AGENT TYPES ---
export type CMSActionType = 'write_to_editor' | 'rewrite_selection' | 'apply_theme' | 'ask_user_choice' | 'none';

export interface CMSAgentResponse {
    thought: string;   
    reply: string;     
    action: {
        type: CMSActionType;
        args: any;
    };
}

export interface CMSMessage extends ChatMessage {
    uiOptions?: { label: string; value: string; style?: string }[]; 
    isActionExecuted?: boolean;
}

export enum AgentMode {
  PLANNER = 'PLANNER', 
  DESIGNER = 'DESIGNER', 
  CODER = 'CODER', 
  IDLE = 'IDLE'
}
