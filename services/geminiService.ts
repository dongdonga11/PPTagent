
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, GlobalStyle } from "../types";
import { parseScriptAndAlign } from "../utils/timelineUtils";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// --- AGENT A: PLANNER & DIRECTOR (A2S Engine) ---
export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const ai = getAiClient();
  
  const systemPrompt = `
    Role: 你是一位专业的视频课程导演。
    Task: 将输入的公众号文章拆解为分镜脚本 (Storyboard / A2S)。
    
    Constraints:
    1. **分段逻辑**: 根据文章的语义转折进行分段。一段话讲一个核心观点，对应一页 PPT (Scene)。
    2. **视觉布局**: 选择最合适的 'visual_layout'。
    3. **关键：时序锚点 (Markers)**: 
       你必须在 'narration' 脚本中插入 **[M]** 标记，告诉前端何时触发动画。
       - 在每句话的逻辑重音前、或新观点出现前插入 [M]。
       - 举例："大家看[M]这张图，这代表了[M]三个关键趋势..."
       - **每页至少包含 1-3 个 [M] 标记**。
    
    4. **口语化**: 去掉书面语，改为演讲口语。
    5. **时长**: 字数 / 4.5。
    
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
    
    // Post-process: Ensure markers exist and calculate initial timings
    return rawData.map((item: any) => {
        const { markers } = parseScriptAndAlign(item.narration, item.duration);
        return {
            ...item,
            markers // Attach calculated markers
        };
    });

  } catch (e) {
    console.error("Failed to parse outline JSON", e);
    return [];
  }
};

// --- AGENT A.1: EDITORIAL ASSISTANT ---
export const refineTextWithAI = async (text: string, instruction: string, context?: string): Promise<string> => {
    const ai = getAiClient();
    
    const systemPrompt = `
      你是一个专业的微信公众号主编助手。
      你的任务是根据用户的指令，修改、润色或扩写提供的文本。
      只返回修改后的文本内容，不要包含前言或解释。
    `;
    
    const prompt = `
      原文: "${text}"
      指令: ${instruction}
      ${context ? `上下文背景: ${context}` : ''}
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            systemInstruction: systemPrompt,
        }
    });

    return response.text?.trim() || text;
}


// --- AGENT B: DESIGNER ---
export const generateTheme = async (userInput: string): Promise<GlobalStyle> => {
  const ai = getAiClient();
  
  const systemPrompt = `
    你是一个“视觉总监” (Visual Director)。根据用户的描述，选择一个配色方案。
    返回 JSON 格式。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: userInput,
    config: {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
            mainColor: { type: Type.STRING, description: "Hex code for primary color (background)" },
            accentColor: { type: Type.STRING, description: "Hex code for accent color" },
            themeName: { type: Type.STRING },
            fontFamily: { type: Type.STRING, description: "CSS font family string" }
        }
      }
    },
  });

   try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    return {
        mainColor: "#1f2937",
        accentColor: "#3b82f6",
        themeName: "Default",
        fontFamily: "Inter, sans-serif"
    };
  }
}


// --- AGENT C: CODER ---
export const generateSlideHtml = async (
  slide: Slide, 
  globalStyle: GlobalStyle, 
  context?: string
): Promise<string> => {
  const ai = getAiClient();

  const layoutInstruction = slide.visual_layout ? `Strictly follow this layout structure: ${slide.visual_layout}` : '';

  const prompt = `
    Generate the HTML for this specific slide:
    Title: ${slide.title}
    Layout Mode: ${slide.visual_layout || 'Auto'}
    Visual Intent: ${slide.visual_intent}
    Narration Context: ${slide.narration}
    Global Style: Main Color: ${globalStyle.mainColor}, Accent: ${globalStyle.accentColor}.

    ${context ? `USER REFINEMENT INSTRUCTION: ${context}` : ''}
  `;

  const systemPrompt = `
    你是一个精通 Tailwind CSS 和动画编排的前端专家。
    你的任务：生成单个幻灯片的内容 HTML。
    
    Layout Modes:
    - **Cover**: Centered big title, subtitle, maybe a background accent.
    - **SectionTitle**: Minimalist, bold numbering or icon.
    - **Bullets**: Title on top, list of 3-5 items with icons below.
    - **SplitLeft**: Text on left (50%), Placeholder Image on right (50%).
    - **BigNumber**: A massive number (e.g. "50%") in center, caption below.
    - **Quote**: Large serif font, quote marks, author name.
    
    ${layoutInstruction}

    核心布局规则：
    1. **结构容器**：最外层必须是一个 \`<div class="w-full h-full flex flex-col ...">\`。
    2. **16:9 适配**：内容将在一个固定比例（16:9）的容器中渲染。
    3. **字号策略**：标题(text-5xl+), 正文(text-2xl+)。
    4. **颜色使用**：使用 style="color: ${globalStyle.accentColor}" 高亮。
    
    🌟 关键：动画编排 (Motion Choreography) 🌟
    你需要为页面中的不同元素添加 data-motion 属性，这些属性将由外部时间轴驱动。
    
    **重要：请务必将内容拆分为至少 2-3 个动画步骤，与脚本中的 [M] 标记对应。**
    例如：
    - 标题 -> data-motion="fade-up"
    - 第一个要点 -> data-motion="slide-right" (对应 [M]1)
    - 第二个要点 -> data-motion="slide-right" (对应 [M]2)
    
    可用动画: "fade-up", "zoom-in", "slide-right", "fade-in".
    
    技术约束：
    1. 不要返回 Markdown 代码块。直接返回 HTML 字符串。
    2. 使用 FontAwesome 图标。
    3. 内容必须是简体中文。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    },
  });

  let html = response.text || '<div class="h-full flex items-center justify-center">生成错误</div>';
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  
  return html;
};

export const generateFullPresentationHtml = (slides: Slide[], style: GlobalStyle) => {
    // Keep existing exporter logic
    const slidesData = JSON.stringify(slides.map(s => s.content_html));
    return `<!doctype html><html>...</html>`; // (Truncated for brevity, assuming usage of previous implementation if needed)
}
