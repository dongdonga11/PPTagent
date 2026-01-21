import { GoogleGenAI, Type } from "@google/genai";
import { Slide, GlobalStyle } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// --- AGENT A: PLANNER ---
// Generates the JSON outline
export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const ai = getAiClient();
  
  const systemPrompt = `
    你是一个演示文稿“架构师” (Structure Architect)。
    你的目标是分析用户的请求，并生成 Reveal.js 演示文稿的结构化 JSON 大纲。
    
    规则：
    1. 创建符合逻辑的流程（例如：封面 -> 问题引入 -> 解决方案 -> 详细功能 -> 价值/数据 -> 总结）。
    2. 除非用户另有说明，否则建议生成 5-8 页幻灯片。
    3. 'visual_intent' 字段必须描述布局意图（例如：“左文右图”、“三列网格”、“大字居中标题”、“数据漏斗图”）。
    4. 'content_html' 初始为空。
    5. **所有生成的标题 (title) 和演讲备注 (speaker_notes) 必须使用简体中文。**
    
    输出格式：JSON 对象数组 (Array of objects)。
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
            visual_intent: { type: Type.STRING },
            speaker_notes: { type: Type.STRING },
          },
          required: ["title", "visual_intent", "speaker_notes"],
        },
      },
    },
  });

  try {
    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse outline JSON", e);
    return [];
  }
};

// --- AGENT B: DESIGNER (Simple implementation for now) ---
// Returns a color palette suggestion
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
            mainColor: { type: Type.STRING, description: "Hex code for primary color" },
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
        mainColor: "#ffffff",
        accentColor: "#3b82f6",
        themeName: "Default",
        fontFamily: "sans-serif"
    };
  }
}


// --- AGENT C: CODER ---
// Generates the HTML for a single slide
export const generateSlideHtml = async (
  slide: Slide, 
  globalStyle: GlobalStyle, 
  context?: string
): Promise<string> => {
  const ai = getAiClient();

  const prompt = `
    Generate the HTML for this specific slide:
    Title: ${slide.title}
    Visual Intent: ${slide.visual_intent}
    Speaker Notes context: ${slide.speaker_notes}
    Global Style: Main Color: ${globalStyle.mainColor}, Accent: ${globalStyle.accentColor}.

    ${context ? `USER REFINEMENT INSTRUCTION: ${context}` : ''}
  `;

  const systemPrompt = `
    你是一个精通 Reveal.js 和 Tailwind CSS 的前端专家 (Frontend Coder)。
    你的任务：生成单个 <section> 的内部 HTML 内容。
    
    技术约束：
    1. 不要将结果包裹在 \`\`\`html 代码块中。直接返回原始 HTML 字符串。
    2. 最外层元素必须是 <section>。
    3. 使用 Tailwind CSS 进行内部布局（grid, flex, text sizes, colors）。
    4. 仅对特定动态颜色使用内联样式 (inline styles)：
       - 强调色使用 style="color: ${globalStyle.accentColor}"。
       - 背景色如果需要，使用 style="background-color: ${globalStyle.mainColor}"。
    5. 针对 "Visual Intent" (视觉意图)，使用 HTML/CSS 形状或布局类来实现。
       - "Split" (分栏): <div class="grid grid-cols-2 gap-4">...</div>
       - "Card" (卡片): <div class="p-6 bg-white/10 rounded-lg backdrop-blur">...</div>
    6. **不要**使用外部图片链接，除非使用 picsum.photos。尽量用 FontAwesome 图标或几何图形代替图片。
    7. 风格必须专业、现代。兼容深色模式 (text-white/gray-200)。
    8. 使用 FontAwesome 图标 (<i class="fa-solid fa-star"></i>) 增加视觉效果。
    9. **生成的所有文本内容（标题、段落、列表等）必须是简体中文。**
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.7, // Creativity allowed for layout
    },
  });

  let html = response.text || "<section><h2>生成幻灯片出错</h2></section>";
  
  // Cleanup if model returns markdown block
  html = html.replace(/```html/g, '').replace(/```/g, '').trim();
  
  return html;
};

// --- EXPORTER ---
export const generateFullPresentationHtml = (slides: Slide[], style: GlobalStyle) => {
    const slidesHtml = slides.map(s => s.content_html).join('\n');
    return `
<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>SpaceCoding 演示文稿</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reset.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/theme/black.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            :root {
                --main-color: ${style.mainColor};
                --accent-color: ${style.accentColor};
            }
            .reveal { font-family: ${style.fontFamily}, sans-serif; }
        </style>
    </head>
    <body>
        <div class="reveal">
            <div class="slides">
                ${slidesHtml}
            </div>
        </div>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.js"></script>
        <script>
            Reveal.initialize({
                hash: true,
                center: true,
                controls: true,
                progress: true,
            });
        </script>
    </body>
</html>
    `;
}