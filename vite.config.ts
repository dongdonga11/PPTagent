import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // 根据 AI_PROVIDER 选择对应的 API Key
    const provider = env.AI_PROVIDER || 'gemini';
    let apiKey = env.GEMINI_API_KEY;
    
    if (provider === 'deepseek') {
      apiKey = env.DEEPSEEK_API_KEY;
    } else if (provider === 'glm') {
      apiKey = env.GLM_API_KEY;
    }
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(apiKey),
        'process.env.AI_PROVIDER': JSON.stringify(provider),
        'process.env.DEEPSEEK_MODEL': JSON.stringify(env.DEEPSEEK_MODEL),
        'process.env.GLM_MODEL': JSON.stringify(env.GLM_MODEL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
