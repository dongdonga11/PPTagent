# Technology Stack

## Build System

- **Bundler**: Vite 6.2.0
- **Package Manager**: npm
- **TypeScript**: 5.8.2
- **Module System**: ESNext with ES2022 target

## Core Framework

- **React**: 19.2.3 (latest)
- **React DOM**: 19.2.3

## Key Libraries

- **AI/ML**: @google/genai 0.2.0 (Google Gemini API)
- **Rich Text Editor**: Tiptap 2.6.6 (core + extensions)
  - starter-kit, placeholder, image, bubble-menu, floating-menu
- **Animation**: framer-motion 10.16.4
- **Utilities**: 
  - uuid 9.0.1 (ID generation)
  - classnames 2.3.2 (CSS class management)

## Configuration

- **Path Aliases**: `@/*` maps to project root
- **Dev Server**: Port 3000, host 0.0.0.0
- **Environment**: GEMINI_API_KEY required in .env.local

## Common Commands

```bash
# Development
npm run dev          # Start dev server on port 3000

# Production
npm run build        # Build for production
npm run preview      # Preview production build

# Setup
npm install          # Install dependencies
```

## Code Style

- TypeScript strict mode disabled for flexibility
- Experimental decorators enabled
- JSX: react-jsx (automatic runtime)
- No emit mode (Vite handles compilation)
