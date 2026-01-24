# Project Structure

## Root Files

- `App.tsx` - Main application component with stage routing and global state
- `index.tsx` - React entry point
- `types.ts` - Centralized TypeScript type definitions
- `index.html` - HTML template
- `metadata.json` - Project metadata

## Folder Organization

### `/components`
UI components organized by feature stage:

**Core Navigation**
- `ProjectDashboard.tsx` - Central hub showing all content assets
- `StageSidebar.tsx` - Stage navigation sidebar

**Content Creation**
- `ArticleEditor.tsx` - CMS editor for article writing
- `CMSChatPanel.tsx` - AI chat interface for content assistance
- `ResearchPanel.tsx` - Topic research and ideation

**Video Production**
- `ScriptEngine.tsx` - A2S storyboard breakdown
- `ScriptEditor.tsx` - Scene script editing
- `ScriptTableView.tsx` - Tabular script view
- `ScriptStoryboard.tsx` - Visual storyboard layout
- `ScriptMarkerEditor.tsx` - Timeline marker editing
- `VideoStage.tsx` - Video synthesis and timeline

**Presentation**
- `SlideList.tsx` - Slide thumbnail list
- `SlidePreview.tsx` - Individual slide preview
- `PresentationRunner.tsx` - Fullscreen presentation mode

**Social Media**
- `PosterEditor.tsx` - Xiaohongshu/Instagram poster generator

**Utilities**
- `ChatInterface.tsx` - Reusable chat UI
- `CodeEditor.tsx` - HTML code editor for slides
- `TiptapEditor.tsx` - Rich text editor wrapper
- `AssetLibrary.tsx` - Media asset management
- `GlobalSettingsModal.tsx` - Global settings UI

### `/services`
External API integrations:
- `geminiService.ts` - Google Gemini AI API (content generation, TTS, image gen)
- `githubService.ts` - GitHub API for content storage
- `styleManager.ts` - Theme and style management

### `/utils`
Helper functions:
- `scriptUtils.ts` - Script parsing and duration calculation
- `timelineUtils.ts` - Timeline marker alignment
- `audioUtils.ts` - Audio processing utilities
- `wechatStyleEngine.ts` - WeChat-specific styling

## State Management

Global state managed in `App.tsx` using React useState:
- `PresentationState` - Project data, slides, stage
- `activeSlideId` - Current slide selection
- `messages` - Chat history
- `mode` - Agent mode (PLANNER/DESIGNER/CODER/IDLE)

## Type System

All types defined in `types.ts`:
- `Slide` - Visual + audio + animation data
- `ProjectStage` - Workflow stage enum
- `GlobalStyle` - Theme configuration
- `CMSAgentResponse` - AI agent response format
- `UserStyleProfile` - User preferences
