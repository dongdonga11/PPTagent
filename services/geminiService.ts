
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Slide, GlobalStyle, ResearchTopic, UserStyleProfile, CMSAgentResponse, CMSMessage } from "../types";
import { parseScriptAndAlign } from "../utils/timelineUtils";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// --- CMS: INTELLIGENT AGENT (Chat & Tools) ---
export const cmsAgentChat = async (
    history: CMSMessage[],
    userInput: string,
    context: {
        topic: ResearchTopic | null;
        profile: UserStyleProfile;
        currentSelection?: string;
        articleContent?: string;
    }
): Promise<CMSAgentResponse> => {
    const ai = getAiClient();

    const systemPrompt = `
      Role: You are a Senior Chief Editor Agent for a WeChat Official Account CMS.
      Your Goal: Assist the user in writing a high-quality article. 
      
      CRITICAL INSTRUCTION: **BE AUTONOMOUS & EFFICIENT**.
      - Do NOT ask for "Continue" confirmation after every step.
      - If the user selects an option, **IMMEDIATELY** execute the writing action for that option.
      - Write substantial content (whole sections) in one go using 'write_to_editor'.
      
      User Profile:
      - Tone: ${context.profile.tone}
      - Forbidden Words: ${context.profile.forbiddenWords.join(', ')}
      
      Current Context:
      - Topic: ${context.topic?.title || 'General'}
      - Article Content Length: ${context.articleContent?.length || 0} chars
      - User Selection: "${context.currentSelection || 'None'}"
      
      Action Logic (Tools):
      1. "write_to_editor": 
         - Use this to write new content. 
         - Format: HTML (use <h2> for subheaders, <p>, <ul>, <blockquote>).
         - WHEN TO USE: 
           - User says "Continue" -> Write the next logical section (e.g., if Intro exists, write Main Body 1).
           - User selects an Angle (e.g., "Story Mode") -> Write the Introduction immediately.
      
      2. "rewrite_selection": 
         - Use ONLY if the user has highlighted text and asked for a change.
      
      3. "ask_user_choice": 
         - Use ONLY when a major directional decision is needed that you cannot infer.
         - Do NOT use for small steps. 
         - Example: Starting a brand new article, or choosing between "Conclusion" vs "Call to Action".
      
      4. "apply_theme": If user mentions colors/styles.
      
      Examples:
      - Input: "我选择：🔥 痛点切入" -> Action: "write_to_editor" (Content: "<h2>为什么你总是感到焦虑？</h2><p>数据表明...</p>")
      - Input: "继续" -> Action: "write_to_editor" (Content: Next section of the article)
      - Input: "帮我写个结尾" -> Action: "write_to_editor" (Content: Conclusion)
      
      Output Format: JSON ONLY.
      {
        "thought": "Reasoning...",
        "reply": "Brief confirmation (e.g., 'Writing the introduction...')",
        "action": { "type": "...", "args": {} }
      }
    `;

    // Construct history for Gemini
    // We only take the last few turns to save tokens, but enough for context
    const chatHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const fullPrompt = `${chatHistory}\nUSER: ${userInput}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        thought: { type: Type.STRING },
                        reply: { type: Type.STRING },
                        action: {
                            type: Type.OBJECT,
                            properties: {
                                type: { 
                                    type: Type.STRING, 
                                    enum: ['write_to_editor', 'rewrite_selection', 'apply_theme', 'ask_user_choice', 'none'] 
                                },
                                args: { 
                                    type: Type.OBJECT,
                                    // Properties must be defined for OBJECT type to avoid 400 error
                                    properties: {
                                        content: { type: Type.STRING },
                                        themeId: { type: Type.STRING },
                                        options: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    label: { type: Type.STRING },
                                                    value: { type: Type.STRING }
                                                }
                                            }
                                        }
                                    }
                                } 
                            },
                            required: ['type']
                        }
                    },
                    required: ['thought', 'reply', 'action']
                }
            }
        });

        const text = response.text || "{}";
        return JSON.parse(text) as CMSAgentResponse;

    } catch (e) {
        console.error("Agent Error", e);
        return {
            thought: "Error",
            reply: "Sorry, I encountered an error. Please try again.",
            action: { type: 'none', args: {} }
        };
    }
};

// --- EXISTING CMS FUNCTIONS (Research, Image, etc) ---

export const performResearchAndIdeation = async (keyword: string, fileContent: string = ''): Promise<ResearchTopic[]> => {
    const ai = getAiClient();
    const systemPrompt = `WeChat Content Strategist. Generate 10-20 topics based on keyword. Return JSON array.`;
    const userPrompt = `Keyword: ${keyword}\nContext: ${fileContent.substring(0, 3000)}`;
    try {
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
        const raw = JSON.parse(response.text || "[]");
        return raw.map((item: any, idx: number) => ({ id: `topic-${idx}-${Date.now()}`, ...item }));
    } catch (e) { return [{ id: 'err', title: 'Research Failed', coreViewpoint: 'Retry', hotScore: 0 }]; }
}

export const generateAiImage = async (prompt: string): Promise<string | undefined> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
        });
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return undefined;
    } catch (e) { return undefined; }
};

export const generateArticleSection = async (currentContent: string, instruction: string, profile: UserStyleProfile): Promise<string> => {
    // Legacy function, replaced by Agent but kept for simple calls
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${currentContent.substring(currentContent.length - 500)}\nInstruction: ${instruction}`,
        config: { systemInstruction: `Writer Persona: ${profile.tone}. Return HTML.` }
    });
    return response.text?.trim() || "";
}

// --- PRESENTATION FUNCTIONS (Preserved) ---
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
        contents: `Text: ${text}\nInstr: ${instruction}`,
    });
    return response.text?.trim() || text;
};

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
