
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Slide, GlobalStyle, ResearchTopic, UserStyleProfile, CMSAgentResponse, CMSMessage, ChatMessage } from "../types";
import { parseScriptAndAlign } from "../utils/timelineUtils";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// --- PPT CONVERSATIONAL AGENT ---

export interface PPTAgentResponse {
    reply: string;
    action?: {
        type: 'update_style' | 'generate_outline' | 'create_slides' | 'none';
        data?: any;
    };
}

export const pptAgentChat = async (
    history: ChatMessage[],
    userInput: string,
    articleContent: string,
    articleTitle: string
): Promise<PPTAgentResponse> => {
    const ai = getAiClient();
    
    // Convert ChatMessage to history string
    const conversationHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    
    const systemPrompt = `
      Role: You are "SpaceCoding PPT Architect" (演示架构师).
      Mission: Guide the user to create a stunning presentation based on the provided article.
      
      --- CONTEXT ---
      Article Title: "${articleTitle}"
      Article Content (Snippet): "${articleContent.substring(0, 1000)}..."
      
      --- WORKFLOW STATE MACHINE ---
      1. **STYLE_PHASE**: If user hasn't defined a style/color yet, ask for it.
         - Output Action: 'update_style' (if user provides specific colors/theme).
      2. **OUTLINE_PHASE**: Once style is known, generate a Text-Based Outline for approval.
         - Reply: "Based on the [Style], here is the outline:\n1. Title...\n2. Section..."
         - Ask: "Does this structure look good? Shall I build it?"
      3. **BUILD_PHASE**: If user says "Yes/Go/Build", generate the JSON slides.
         - Output Action: 'create_slides'.
      
      --- RULES ---
      - Tone: Professional, Geeky, Efficient. (SpaceCoding style).
      - If user asks for "Tech Style", imply Dark Mode + Blue/Purple.
      - If user asks for "Minimal", imply White/Gray + Clean fonts.
      - When generating 'create_slides', the 'data' must be a JSON Array of Slide objects (title, visual_layout, visual_intent, narration).
      
      --- JSON OUTPUT FORMAT ---
      Return ONLY a JSON object. No markdown.
      {
        "thought": "Reasoning...",
        "reply": "Message to user...",
        "action": {
            "type": "update_style" | "generate_outline" | "create_slides" | "none",
            "data": ... (Object for style, Array for slides, or null)
        }
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `${conversationHistory}\nUSER: ${userInput}`,
            config: {
                systemInstruction: systemPrompt,
                responseMimeType: "application/json",
                // Thinking config helps with complex logic flow
                // thinkingConfig: { thinkingBudget: 1024 }, // Optional, use if available
            }
        });

        const text = response.text || "{}";
        return JSON.parse(text) as PPTAgentResponse;
    } catch (e) {
        console.error("PPT Agent Error", e);
        return {
            reply: "系统连接中断，请重试。",
            action: { type: 'none' }
        };
    }
};

// --- EXISTING CMS & HELPER FUNCTIONS ---

// ... (Keep existing cmsAgentChat, extractGoldenQuotes, etc. exactly as they were to prevent breaking other modules)
// I will rewrite them briefly here to ensure file integrity, assuming they are needed.

// --- POSTER AGENT: EXTRACT QUOTES ---
export const extractGoldenQuotes = async (articleText: string): Promise<string[]> => {
    const ai = getAiClient();
    const systemPrompt = `Role: Copywriter. Task: Extract 6-8 quotes. Output: JSON Array string[].`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Content: ${articleText.substring(0, 5000)}`,
            config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) { return ["Extraction failed."]; }
};

// --- CMS AGENT ---
export const cmsAgentChat = async (history: CMSMessage[], userInput: string, context: any): Promise<CMSAgentResponse> => {
    const ai = getAiClient();
    const systemPrompt = `Role: SpaceCoding Editor. Tone: ${context.profile.tone}. Task: Help write article. Output JSON: {thought, reply, action: {type, args}}`;
    const chatHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `${chatHistory}\nUSER: ${userInput}`,
            config: { systemInstruction: systemPrompt, responseMimeType: "application/json" }
        });
        return JSON.parse(response.text || "{}") as CMSAgentResponse;
    } catch (e) { return { thought: 'err', reply: 'Error', action: { type: 'none', args: {} } }; }
};

export const performResearchAndIdeation = async (keyword: string, fileContent: string = ''): Promise<ResearchTopic[]> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Keyword: ${keyword}\nContext: ${fileContent}`,
            config: {
                systemInstruction: "Generate 10 topics. JSON Array.",
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });
        const raw = JSON.parse(response.text || "[]");
        return raw.map((item: any, idx: number) => ({ id: `topic-${idx}-${Date.now()}`, ...item }));
    } catch (e) { return []; }
}

export const generateAiImage = async (prompt: string): Promise<string | undefined> => {
    const ai = getAiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
        });
        return response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data 
            ? `data:image/png;base64,${response.candidates[0].content.parts.find(p => p.inlineData)?.inlineData?.data}`
            : undefined;
    } catch (e) { return undefined; }
};

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
  } catch (error) { return undefined; }
};

// Used for ScriptEngine direct generation
export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const ai = getAiClient();
  const systemPrompt = `Role: Director. Task: Article to Script (JSON Array).`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userInput,
    config: { systemInstruction: systemPrompt, responseMimeType: "application/json" },
  });
  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const refineTextWithAI = async (text: string, instruction: string): Promise<string> => { 
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
      systemInstruction: "Visual Director. JSON output {mainColor, accentColor, themeName, fontFamily}.",
      responseMimeType: "application/json"
    },
  });
   try { return JSON.parse(response.text || "{}"); } 
   catch (e) { return { mainColor: "#1f2937", accentColor: "#3b82f6", themeName: "Default", fontFamily: "Inter, sans-serif" }; }
}

export const generateSlideHtml = async (slide: Slide, globalStyle: GlobalStyle, context?: string): Promise<string> => {
  const ai = getAiClient();
  const prompt = `Generate HTML for slide: ${slide.title}. Layout: ${slide.visual_layout}. Intent: ${slide.visual_intent}. Narration: ${slide.narration}. Style: ${globalStyle.mainColor}, ${globalStyle.accentColor}. ${context || ''}`;
  const systemPrompt = `Role: Expert Frontend Developer (SpaceCoding Edition).
  Task: Create a visually stunning, Space/Tech-themed HTML component for a slide.
  Constraints:
  1. Use Tailwind CSS for ALL styling.
  2. The outer container is 100% width/height.
  3. Use Glassmorphism (bg-opacity, backdrop-blur), Gradients (bg-gradient-to-r), and modern typography.
  4. IMPORTANT: For animations, ONLY use 'data-motion' attributes on elements (e.g., data-motion="fade-up", "slide-right", "zoom-in"). DO NOT write <script> tags or CSS keyframes.
  5. Layout MUST match: ${slide.visual_layout}.
  6. Return ONLY the HTML body content (divs), no <html> or <body> tags.
  `;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { systemInstruction: systemPrompt, temperature: 0.7 },
  });
  let html = response.text || '<div class="h-full flex items-center justify-center">Error</div>';
  return html.replace(/```html/g, '').replace(/```/g, '').trim();
};
