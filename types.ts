export interface Slide {
  id: string;
  title: string;
  visual_intent: string;
  speaker_notes: string;
  content_html: string; // The full <section> HTML
  isGenerated: boolean;
  isLoading: boolean;
}

export interface GlobalStyle {
  themeName: string;
  mainColor: string;
  accentColor: string;
  fontFamily: string;
}

export interface PresentationState {
  projectId: string;
  title: string;
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
  PLANNER = 'PLANNER', // Generating Outline
  DESIGNER = 'DESIGNER', // Setting styles
  CODER = 'CODER', // Generating HTML
  IDLE = 'IDLE'
}