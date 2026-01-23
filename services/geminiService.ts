
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

    // Context Analysis
    const contentLen = context.articleContent?.length || 0;
    const hasSelection = (context.currentSelection?.length || 0) > 0;
    
    // Construct System Prompt based on "Smart CMS" PRD
    const systemPrompt = `
      Role: You are "Smart CMS", an Intelligent Co-pilot for WeChat Content Creation.
      User Persona: "${context.profile.name}" (Tone: ${context.profile.tone}).
      
      --- CURRENT STATE CONTEXT ---
      Topic: ${context.topic?.title || 'General Topic'}
      Article Length: ${contentLen} chars.
      Selected Text: "${context.currentSelection || 'None'}"
      
      --- AGENT BEHAVIOR RULES (STATE MACHINE) ---
      
      1. PHASE: IDEATION (Start)
         - If user picks an Angle (e.g., "Story Mode"), DO NOT just say "Ok".
         - ACTION: Immediately propose an Outline OR Start Writing. 
         - Use 'ask_user_choice' to confirm: "Generate Outline" vs "Start Writing Directly".
      
      2. PHASE: WRITING (Autonomous)
         - If user says "Start" or "Continue" or confirms outline:
         - ACTION: Use 'write_to_editor' to write the NEXT logical section (e.g., Intro + First H2).
         - CRITICAL: Do NOT ask "Shall I continue?" after every sentence. Write substantial blocks (300-500 words).
         - Style: Use HTML (<h2>, <p>, <blockquote>, <ul>). Match user tone.
      
      3. PHASE: REFINING (Selection Active)
         - Trigger: User has SELECTED text: "${context.currentSelection?.substring(0, 20)}...".
         - If user input is vague (e.g., "Fix this"), infer intent -> 'rewrite_selection'.
         - If user input is specific (e.g., "Make it a quote"), -> 'rewrite_selection' with <blockquote>.
      
      4. PHASE: STYLING
         - If user mentions "Colors", "Theme", "Layout":
         - ACTION: Use 'ask_user_choice' with 'style' property for color swatches.
         - OR 'apply_theme' if they specificy a name.
      
      --- TOOLS (JSON OUTPUT) ---
      
      1. "write_to_editor": Append content to the end (or insert at cursor if no selection).
         Args: { content: "<html>..." }
      
      2. "rewrite_selection": REPLACE the currently selected text.
         Args: { content: "<html>..." }
      
      3. "ask_user_choice": Force user to pick a path.
         Args: { options: [{ label: "Story Mode", value: "story" }, { label: "Data Mode", value: "data" }] }
         
      4. "apply_theme":
         Args: { themeId: "kaoxing" | "tech" | "default" }
      
      5. "none": Pure text reply.
      
      --- OUTPUT FORMAT ---
      Return JSON ONLY.
      {
        "thought": "User selected text, asking for refinement...",
        "reply": "I've polished this paragraph to be more punchy.",
        "action": { "type": "rewrite_selection", "args": { "content": "..." } }
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
                // Strict Schema Definition to avoid 400 Errors
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
                                    // Union of all possible args for flexibility
                                    properties: {
                                        content: { type: Type.STRING },
                                        themeId: { type: Type.STRING },
                                        options: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    label: { type: Type.STRING },
                                                    value: { type: Type.STRING },
                                                    style: { type: Type.STRING } // For color hex
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

// --- EXISTING CMS FUNCTIONS (Kept for compatibility) ---

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
