
import { Slide, GlobalStyle, ResearchTopic, UserStyleProfile, CMSAgentResponse, CMSMessage } from "../types";
import { parseScriptAndAlign } from "../utils/timelineUtils";
import { generateText, generateJSON, generateImage, generateSpeech } from "./aiService";

// --- POSTER AGENT: EXTRACT QUOTES ---
export const extractGoldenQuotes = async (articleText: string): Promise<string[]> => {
    const systemPrompt = `
      Role: Social Media Copywriter (Xiaohongshu/Instagram Expert).
      Task: Extract 6-8 "Golden Sentences" from the provided text.
      Style: Short, punchy, insightful, high shareability. Avoid long paragraphs.
      Output: JSON Array of strings.
    `;
    
    if (!articleText || articleText.length < 50) {
        return ["暂无足够内容，请先在文案环节创作。", "这是第二条示例金句。", "点击 AI 提取按钮开始工作。"];
    }

    try {
        const result = await generateJSON<string[]>(
            `Article Content:\n${articleText.substring(0, 8000)}`,
            systemPrompt
        );
        return Array.isArray(result) ? result : [];
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
    const contentLen = context.articleContent?.length || 0;
    
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

    const chatHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    const fullPrompt = `${chatHistory}\nUSER: ${userInput}`;

    try {
        return await generateJSON<CMSAgentResponse>(fullPrompt, systemPrompt);
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
    const systemPrompt = `WeChat Content Strategist. Generate 10-20 topics based on keyword. Return JSON array with fields: title, coreViewpoint, hotScore.`;
    const userPrompt = `Keyword: ${keyword}\nContext: ${fileContent.substring(0, 3000)}`;
    
    try {
        const result = await generateJSON<any[]>(userPrompt, systemPrompt);
        return result.map((item: any, idx: number) => ({ 
            id: `topic-${idx}-${Date.now()}`, 
            title: item.title || '',
            coreViewpoint: item.coreViewpoint || '',
            hotScore: item.hotScore || 0
        }));
    } catch (e) { 
        return [{ id: 'err', title: 'Research Failed', coreViewpoint: 'Retry', hotScore: 0 }]; 
    }
}

export const generateAiImage = async (prompt: string): Promise<string | undefined> => {
    return generateImage(prompt);
};

export const generateArticleSection = async (currentContent: string, instruction: string, profile: UserStyleProfile): Promise<string> => {
    const systemPrompt = `Writer Persona: ${profile.tone}. Return HTML.`;
    const prompt = `Context: ${currentContent.substring(currentContent.length - 500)}\nInstruction: ${instruction}`;
    return await generateText(prompt, systemPrompt) || "";
}

export { generateSpeech };

export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const systemPrompt = `
    Role: 你是一位专业的视频课程导演。
    Task: 将输入的公众号文章拆解为分镜脚本 (Storyboard / A2S)。
    Constraints: 
    1. 每个场景 3-8 秒，适合短视频节奏
    2. 视觉布局从以下选择: Cover, SectionTitle, Bullets, SplitLeft, SplitRight, BigNumber, Quote, GridFeatures
    3. 旁白中插入 [M] 标记表示动画时机
    4. 口语化表达，避免书面语
    5. 估算每个场景的时长（秒）
    Output Format: JSON Array with fields: title, visual_layout, visual_intent, narration, duration
  `;
  
  try {
    const rawData = await generateJSON<any[]>(userInput, systemPrompt);
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
    const prompt = `Text: ${text}\nInstruction: ${instruction}${context ? `\nContext: ${context}` : ''}`;
    return await generateText(prompt) || text;
};

export const generateTheme = async (userInput: string): Promise<GlobalStyle> => {
  const systemPrompt = "Visual Director. Generate theme with mainColor, accentColor, themeName, fontFamily. Return JSON.";
  
  try { 
    return await generateJSON<GlobalStyle>(userInput, systemPrompt);
  } catch (e) { 
    return { 
      mainColor: "#1f2937", 
      accentColor: "#3b82f6", 
      themeName: "Default", 
      fontFamily: "Inter, sans-serif" 
    }; 
  }
}

export const generateSlideHtml = async (slide: Slide, globalStyle: GlobalStyle, context?: string): Promise<string> => {
  const prompt = `Generate HTML for slide: ${slide.title}. Layout: ${slide.visual_layout}. Intent: ${slide.visual_intent}. Narration: ${slide.narration}. Style: ${globalStyle.mainColor}, ${globalStyle.accentColor}. ${context || ''}`;
  const systemPrompt = `Frontend Coder. Use Tailwind CSS. 16:9 Aspect Ratio. Add data-motion attributes for animations.`;
  
  const html = await generateText(prompt, systemPrompt);
  return html.replace(/```html/g, '').replace(/```/g, '').trim() || '<div class="h-full flex items-center justify-center">Error</div>';
};

export const generateFullPresentationHtml = (slides: Slide[], style: GlobalStyle) => {
    return `<!doctype html><html><body>Presentation</body></html>`; 
}
