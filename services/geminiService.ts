import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Slide, GlobalStyle, ResearchTopic, UserStyleProfile } from "../types";
import { parseScriptAndAlign } from "../utils/timelineUtils";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// --- CMS: RESEARCH ENGINE (with Google Search) ---
export const performResearchAndIdeation = async (keyword: string, fileContent: string = ''): Promise<ResearchTopic[]> => {
    const ai = getAiClient();

    const systemPrompt = `
      You are a WeChat Official Account Content Strategist.
      Task: Based on the User's Keyword (Hot Topic) and provided File Context, generate 10-20 high-potential article topics.
      
      Capabilities:
      - You can access Google Search to find real-time trends if the user provides a keyword.
      
      Rules:
      1. **Pain Points**: Topics must address specific anxieties or needs of the target audience.
      2. **Differentiation**: Avoid generic titles. Use "Curiosity Gap" or "Strong Opinion" styles.
      3. **Hot Score**: Estimate a viral potential score (1-100).
      4. **Core Viewpoint**: Summarize the angle in one sentence.
      5. Output MUST be valid JSON.
    `;

    const userPrompt = `
      Keyword/Topic: ${keyword}
      Context from File: ${fileContent.substring(0, 3000)}...
      
      Please generate a list of topics.
    `;

    try {
        // Use gemini-3-flash-preview for search grounding
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            coreViewpoint: { type: Type.STRING },
                            hotScore: { type: Type.INTEGER }
                        },
                        required: ["title", "coreViewpoint", "hotScore"]
                    }
                }
            }
        });

        // Search grounding response often returns text that contains JSON but might not be pure JSON if search results are mixed in thought chain
        // However, with responseMimeType json, it should be clean.
        const raw = JSON.parse(response.text || "[]");
        return raw.map((item: any, idx: number) => ({
            id: `topic-${idx}-${Date.now()}`,
            ...item
        }));

    } catch (e) {
        console.error("Ideation failed", e);
        // Fallback mock if search fails or key doesn't support it
        return [
            { id: 'err-1', title: 'AI Research Failed (Check Key)', coreViewpoint: 'Please try again', hotScore: 0 }
        ];
    }
}

// --- CMS: IMAGE GENERATION ---
export const generateAiImage = async (prompt: string): Promise<string | undefined> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                // No mimeType for image generation models
            }
        });
        
        // Iterate parts to find the image
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return undefined;
    } catch (e) {
        console.error("Image gen failed", e);
        return undefined;
    }
};

// --- CMS: WRITER (Style Aware) ---
export const generateArticleSection = async (
    currentContent: string, 
    instruction: string, 
    profile: UserStyleProfile
): Promise<string> => {
    const ai = getAiClient();
    
    const styleContext = `
      Persona Configuration:
      - Tone: ${profile.tone}
      - Forbidden Words: ${profile.forbiddenWords.join(', ')}
      - Signature Ending: ${profile.preferredEnding}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Previous Content: "${currentContent.substring(currentContent.length - 1000)}"\n\nInstruction: ${instruction}`,
        config: {
            systemInstruction: `You are a professional WeChat Article Writer. ${styleContext}. Output HTML compatible content (p, h2, ul, blockquote). Do not use markdown blocks.`,
        }
    });

    return response.text?.trim() || "";
}

// --- EXISTING SERVICES (Preserved) ---

export const generateSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string | undefined> => {
  const ai = getAiClient();
  const cleanText = text.replace(/\[M\]|\[M:\d+\]|\[Next\]/g, ' ').trim();
  if (!cleanText) return undefined;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    throw error;
  }
};

export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const ai = getAiClient();
  const systemPrompt = `
    Role: 你是一位专业的视频课程导演。
    Task: 将输入的公众号文章拆解为分镜脚本 (Storyboard / A2S)。
    Constraints: 1. 分段逻辑... 2. 视觉布局... 3. Markers [M]... 4. 口语化... 5. 时长...
    Output Format: JSON Array.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userInput,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            visual_layout: { type: Type.STRING, enum: ['Cover', 'SectionTitle', 'Bullets', 'SplitLeft', 'SplitRight', 'BigNumber', 'Quote', 'GridFeatures'] },
            visual_intent: { type: Type.STRING },
            narration: { type: Type.STRING, description: "Script with [M] tags" },
            duration: { type: Type.NUMBER }
          },
          required: ["title", "visual_layout", "visual_intent", "narration", "duration"],
        },
      },
    },
  });
  try {
    const rawData = JSON.parse(response.text || "[]");
    return rawData.map((item: any) => {
        const { markers } = parseScriptAndAlign(item.narration, item.duration);
        return { ...item, markers };
    });
  } catch (e) {
    console.error("Failed to parse outline JSON", e);
    return [];
  }
};

export const refineTextWithAI = async (text: string, instruction: string, context?: string): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `原文: "${text}"\n指令: ${instruction}\n${context ? `上下文: ${context}` : ''}`,
        config: { systemInstruction: "你是一个专业的微信公众号主编助手。只返回修改后的文本内容。" }
    });
    return response.text?.trim() || text;
}

export const generateTheme = async (userInput: string): Promise<GlobalStyle> => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userInput,
    config: {
      systemInstruction: "Visual Director. JSON output.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
            mainColor: { type: Type.STRING },
            accentColor: { type: Type.STRING },
            themeName: { type: Type.STRING },
            fontFamily: { type: Type.STRING }
        }
      }
    },
  });
   try { return JSON.parse(response.text || "{}"); } 
   catch (e) { return { mainColor: "#1f2937", accentColor: "#3b82f6", themeName: "Default", fontFamily: "Inter, sans-serif" }; }
}

export const generateSlideHtml = async (slide: Slide, globalStyle: GlobalStyle, context?: string): Promise<string> => {
  const ai = getAiClient();
  const prompt = `Generate HTML for slide: ${slide.title}. Layout: ${slide.visual_layout}. Intent: ${slide.visual_intent}. Narration: ${slide.narration}. Style: ${globalStyle.mainColor}, ${globalStyle.accentColor}. ${context || ''}`;
  const systemPrompt = `Frontend Coder. Tailwind CSS. 16:9 Aspect Ratio. Animation data-motion.`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { systemInstruction: systemPrompt, temperature: 0.7 },
  });
  let html = response.text || '<div class="h-full flex items-center justify-center">Error</div>';
  return html.replace(/```html/g, '').replace(/```/g, '').trim();
};

export const generateFullPresentationHtml = (slides: Slide[], style: GlobalStyle) => {
    return `<!doctype html><html><body>Presentation</body></html>`; 
}
