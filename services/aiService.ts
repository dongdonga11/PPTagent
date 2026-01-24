// 统一 AI 服务适配层 - 支持 Gemini / DeepSeek / GLM
import { Slide, GlobalStyle, ResearchTopic, UserStyleProfile, CMSAgentResponse } from "../types";

// 动态导入 Gemini SDK（仅在使用时加载）
let GoogleGenAI: any;
let Type: any;
let Modality: any;

async function loadGeminiSDK() {
  if (!GoogleGenAI) {
    const module = await import("@google/genai");
    GoogleGenAI = module.GoogleGenAI;
    Type = module.Type;
    Modality = module.Modality;
  }
}

// --- AI 服务商类型 ---
export type AIProvider = 'gemini' | 'deepseek' | 'glm';

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  baseURL?: string;
  model?: string;
}

// --- 获取配置 ---
const getAIConfig = (): AIConfig => {
  const provider = (process.env.AI_PROVIDER || 'gemini') as AIProvider;
  const apiKey = process.env.API_KEY || '';
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error("API_KEY is missing from environment variables");
  }

  const config: AIConfig = { provider, apiKey };

  // DeepSeek 配置
  if (provider === 'deepseek') {
    config.baseURL = 'https://api.deepseek.com/v1';
    config.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  }
  
  // GLM (智谱) 配置
  if (provider === 'glm') {
    config.baseURL = 'https://open.bigmodel.cn/api/paas/v4';
    config.model = process.env.GLM_MODEL || 'glm-4-flash';
  }

  return config;
};

// --- OpenAI 兼容接口调用 (DeepSeek / GLM) ---
async function callOpenAICompatible(
  config: AIConfig,
  messages: Array<{ role: string; content: string }>,
  options: {
    temperature?: number;
    response_format?: { type: 'json_object' };
    max_tokens?: number;
  } = {}
): Promise<string> {
  const response = await fetch(`${config.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature || 0.7,
      ...(options.response_format && { response_format: options.response_format }),
      ...(options.max_tokens && { max_tokens: options.max_tokens })
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AI API Error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// --- 统一生成接口 ---
export async function generateText(
  prompt: string,
  systemPrompt?: string,
  options: {
    temperature?: number;
    jsonMode?: boolean;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const config = getAIConfig();

  // Gemini
  if (config.provider === 'gemini') {
    await loadGeminiSDK();
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        ...(systemPrompt && { systemInstruction: systemPrompt }),
        temperature: options.temperature || 0.7,
        ...(options.jsonMode && { responseMimeType: "application/json" })
      }
    });
    return response.text || '';
  }

  // DeepSeek / GLM (OpenAI 兼容)
  const messages: Array<{ role: string; content: string }> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  return callOpenAICompatible(config, messages, {
    temperature: options.temperature,
    ...(options.jsonMode && { response_format: { type: 'json_object' } }),
    ...(options.maxTokens && { max_tokens: options.maxTokens })
  });
}

// --- 结构化 JSON 生成 ---
export async function generateJSON<T = any>(
  prompt: string,
  systemPrompt: string,
  schema?: any
): Promise<T> {
  const config = getAIConfig();

  // Gemini (支持 Schema)
  if (config.provider === 'gemini') {
    await loadGeminiSDK();
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        ...(schema && { responseSchema: schema })
      }
    });
    return JSON.parse(response.text || '{}');
  }

  // DeepSeek / GLM (JSON Mode)
  const messages = [
    { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Return valid JSON only.' },
    { role: 'user', content: prompt }
  ];
  
  const text = await callOpenAICompatible(config, messages, {
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(text);
}

// --- 图片生成 (仅 Gemini 支持) ---
export async function generateImage(prompt: string): Promise<string | undefined> {
  const config = getAIConfig();
  
  if (config.provider !== 'gemini') {
    console.warn('Image generation only supported by Gemini');
    return undefined;
  }

  await loadGeminiSDK();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: { parts: [{ text: prompt }] },
    });
    
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
  } catch (e) {
    console.error('Image generation failed:', e);
  }
  return undefined;
}

// --- 语音生成 (仅 Gemini 支持) ---
export async function generateSpeech(text: string, voiceName: string = 'Kore'): Promise<string | undefined> {
  const config = getAIConfig();
  
  if (config.provider !== 'gemini') {
    console.warn('TTS only supported by Gemini');
    return undefined;
  }

  await loadGeminiSDK();
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const cleanText = text.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, ' ').trim();
  if (!cleanText) return undefined;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("TTS Error:", error);
    throw error;
  }
}

// --- 获取当前服务商信息 ---
export function getProviderInfo(): { provider: AIProvider; model: string } {
  const config = getAIConfig();
  return {
    provider: config.provider,
    model: config.model || 'gemini-2.0-flash-exp'
  };
}
