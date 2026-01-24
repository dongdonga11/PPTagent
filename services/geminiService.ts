
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

// --- POSTER AGENT: EXTRACT QUOTES ---
export const extractGoldenQuotes = async (articleText: string): Promise<string[]> => {
    const ai = getAiClient();
    const systemPrompt = `
      Role: Social Media Copywriter (Xiaohongshu/Instagram Expert).
      Task: Extract 6-8 "Golden Sentences" from the provided text.
      Style: Short, punchy, insightful, high shareability. Avoid long paragraphs.
      Output: JSON Array of strings.
    `;
    
    // Fallback if text is empty
    if (!articleText || articleText.length < 50) {
        return ["暂无足够内容，请先在文案环节创作。", "这是第二条示例金句。", "点击 AI 提取按钮开始工作。"];
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Article Content:\n${articleText.substring(0, 8000)}`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        
        return JSON.parse(response.text || "[]");
    } catch (e) {
        console.error("Failed to extract quotes", e);
        return ["提取失败，请重试。", "AI 服务暂时不可用。"];
    }
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

    // Context Analysis
    const contentLen = context.articleContent?.length || 0;
    
    // Construct System Prompt based on "Smart CMS" PRD
    const systemPrompt = `
      Role: You are "Smart CMS", an Intelligent Co-pilot for WeChat Content Creation.
      User Persona: "${context.profile.name}" (Tone: ${context.profile.tone}).
      
      --- CURRENT STATE CONTEXT ---
      Topic: ${context.topic?.title || 'General Topic'}
      Article Length: ${contentLen} chars.
      Selected Text: "${context.currentSelection || 'None'}"
      
      --- AGENT BEHAVIOR RULES (STATE MACHINE) ---
      
      1. PHASE: IDEATION & OUTLINE (Start)
         - If user picks an Angle, propose a detailed HTML Outline.
         - **IMPORTANT**: When proposing an outline, ALWAYS provide these exact options using 'ask_user_choice':
           A: "确认大纲，全篇生成" (Confirm & Write Full Article)
           B: "调整大纲" (Modify)
      
      2. PHASE: WRITING (Autonomous)
         - **CRITICAL RULE**: If user confirms the outline (e.g., says "Start", "Confirm", or clicks "确认大纲，全篇生成"):
           - ACTION: Use 'write_to_editor' to generate the **ENTIRE ARTICLE** (H1, Intro, Body, Conclusion).
           - REPLY: **MUST** be in the past tense, indicating completion. E.g., "✅ 文章已生成完毕。您可以检查左侧编辑器。"
           - Do NOT say "I am writing" or "Please wait" in the reply, because the action happens instantly.
           - Do NOT stop after the introduction.
      
      3. PHASE: REFINING (Selection Active)
         - If user selects text and asks for changes, use 'rewrite_selection'.
      
      4. PHASE: ASSETS & STYLING
         - **IMAGE GENERATION**: 
           - If user inputs specific command "/image [description]" OR asks "Generate an image of X":
           - ACTION: Use 'insert_image' tool.
           - ARGUMENT: Set 'prompt' to the English description of the image.
         - **THEME**: 
           - If user mentions colors/theme, use 'apply_theme' or 'ask_user_choice'.
      
      --- TOOLS (JSON OUTPUT) ---
      
      1. "write_to_editor": Append content. Args: { content: "<html>..." }
      2. "rewrite_selection": Replace selection. Args: { content: "<html>..." }
      3. "insert_image": Generate and insert AI image. Args: { prompt: "english description...", url: null }
      4. "apply_theme": Args: { themeId: "..." }
      5. "ask_user_choice": Args: { options: [{ label, value, style }] }
      6. "none": Text reply.
      
      --- OUTPUT FORMAT ---
      Return JSON ONLY.
      {
        "thought": "User confirmed outline. I have generated the html.",
        "reply": "✅ 文章已为您生成。接下来您想：",
        "action": { "type": "write_to_editor", "args": { "content": "<h1>Title</h1><p>Intro...</p>..." } }
      }
    `;

    // History Processing
    const chatHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const fullPrompt = `${chatHistory}\nUSER: ${userInput}`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                // Strict Schema Definition
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
                                    enum: ['write_to_editor', 'rewrite_selection', 'insert_image', 'apply_theme', 'ask_user_choice', 'none'] 
                                },
                                args: { 
                                    type: Type.OBJECT,
                                    properties: {
                                        content: { type: Type.STRING },
                                        prompt: { type: Type.STRING }, // For image generation
                                        url: { type: Type.STRING },
                                        themeId: { type: Type.STRING },
                                        options: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    label: { type: Type.STRING },
                                                    value: { type: Type.STRING },
                                                    style: { type: Type.STRING }
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
            thought: "Error in generation",
            reply: "Agent temporarily unavailable. Please try again.",
            action: { type: 'none', args: {} }
        };
    }
};

// --- EXISTING CMS FUNCTIONS ---

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
    const ai = getAiClient();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Context: ${currentContent.substring(currentContent.length - 500)}\nInstruction: ${instruction}`,
        config: { systemInstruction: `Writer Persona: ${profile.tone}. Return HTML.` }
    });
    return response.text?.trim() || "";
}

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
