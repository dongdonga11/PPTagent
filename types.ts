
export type SlideLayoutType = 'Cover' | 'SectionTitle' | 'Bullets' | 'SplitLeft' | 'SplitRight' | 'BigNumber' | 'Quote' | 'GridFeatures';

export interface AnimationMarker {
  id: number;       // 1, 2, 3... corresponding to [M:1], [M:2]
  time: number;     // relative time in seconds from start of slide
  label?: string;   // optional description
}

export interface Slide {
  id: string;
  title: string;
  // Visual Layer
  visual_intent: string; // Description for the AI Coder
  visual_layout: SlideLayoutType; // Structured layout type for consistency
  content_html: string; // The rendered HTML
  
  // Audio Layer (The Script)
  narration: string; // The exact voiceover script with [M:x] tags
  duration: number; // Estimated duration in seconds
  speaker_notes: string;
  audioData?: string; // Base64 encoded PCM audio data from Gemini TTS
  
  // Time-Driven Animation
  markers: AnimationMarker[]; // Calculated timestamps for the tags
  
  // State
  isGenerated: boolean;
  isLoading: boolean;
}

export interface GlobalStyle {
  themeName: string;
  mainColor: string;
  accentColor: string;
  fontFamily: string;
}

export enum ProjectStage {
  STORY = 'STORY',       // Step 1: Write the article
  SCRIPT = 'SCRIPT',     // Step 2: A2S - Breakdown into Scenes (Script Engine)
  VISUAL = 'VISUAL',     // Step 3: AI Coder - Generate HTML
  EXPORT = 'EXPORT'      // Step 4: Finalize
}

export interface PresentationState {
  projectId: string;
  title: string;
  stage: ProjectStage;
  sourceMaterial: string;
  slides: Slide[];
  globalStyle: GlobalStyle;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export enum AgentMode {
  PLANNER = 'PLANNER', 
  DESIGNER = 'DESIGNER', 
  CODER = 'CODER', 
  IDLE = 'IDLE'
}
