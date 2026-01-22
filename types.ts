
export interface Slide {
  id: string;
  title: string;
  visual_intent: string;
  speaker_notes: string; // Internal notes / context
  narration: string; // The exact voiceover script for the video
  duration: number; // Estimated duration in seconds
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

export enum ProjectStage {
  STORY = 'STORY',       // Step 1: Write the article/source text
  SCRIPT = 'SCRIPT',     // Step 2: Breakdown into slides/scenes & adjust narration
  VISUAL = 'VISUAL',     // Step 3: Generate HTML/CSS visuals
  EXPORT = 'EXPORT'      // Step 4: Finalize and Export
}

export interface PresentationState {
  projectId: string;
  title: string;
  stage: ProjectStage;   // Current active stage
  sourceMaterial: string; // The raw article/text
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
