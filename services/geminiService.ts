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
export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const ai = getAiClient();
  
  const systemPrompt = `
    你是一个演示文稿“架构师” (Structure Architect)。
    你的目标是分析用户的请求，并生成演示文稿的结构化 JSON 大纲。
    
    规则：
    1. 创建符合逻辑的流程（例如：封面 -> 问题引入 -> 解决方案 -> 详细功能 -> 价值/数据 -> 总结）。
    2. 建议生成 5-8 页幻灯片。
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

  const prompt = `
    Generate the HTML for this specific slide:
    Title: ${slide.title}
    Visual Intent: ${slide.visual_intent}
    Speaker Notes context: ${slide.speaker_notes}
    Global Style: Main Color: ${globalStyle.mainColor}, Accent: ${globalStyle.accentColor}.

    ${context ? `USER REFINEMENT INSTRUCTION: ${context}` : ''}
  `;

  const systemPrompt = `
    你是一个精通 Tailwind CSS 的前端专家。
    你的任务：生成单个幻灯片的内容 HTML。
    
    核心布局规则（必须严格遵守）：
    1. **结构容器**：最外层必须是一个 \`<div class="w-full h-full flex flex-col ...">\`。不要使用 <section>。
    2. **16:9 适配**：内容将在一个固定比例（16:9）的容器中渲染。使用 flexbox 或 grid 确保内容垂直分布合理，**不要溢出**。
    3. **字号策略**：因为是演示文稿，字体要大。
       - 标题: text-5xl 或 text-6xl (font-bold)
       - 正文: text-2xl 或 text-3xl
       - 次要信息: text-xl
    4. **颜色使用**：
       - 使用 style="color: ${globalStyle.accentColor}" 来高亮关键词。
       - 背景颜色将由父容器处理，你只需要处理文字和内部元素的颜色。默认文字颜色应为白色或浅灰（假设背景深色），或者根据 Global Style 调整。
    5. **精简内容**：将长文本转化为列表 (ul/li) 或卡片 (cards)。
    
    技术约束：
    1. 不要返回 Markdown 代码块。直接返回 HTML 字符串。
    2. 使用 FontAwesome 图标增强视觉效果。
    3. 如果需要图表，使用 CSS 绘制简单的柱状图/进度条，或者使用 picsum.photos 图片。
    4. 内容必须是简体中文。
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

// --- EXPORTER (Lightweight Standalone JS Player) ---
export const generateFullPresentationHtml = (slides: Slide[], style: GlobalStyle) => {
    const slidesData = JSON.stringify(slides.map(s => s.content_html));
    
    return `
<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>演示文稿</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            body { 
                background-color: ${style.mainColor}; 
                color: white; 
                font-family: ${style.fontFamily}, sans-serif;
                overflow: hidden;
            }
            #slide-container {
                width: 100vw;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .slide-content {
                width: 100%;
                max-width: 1280px; /* Max width for 16:9 feel on wide screens */
                aspect-ratio: 16/9;
                padding: 2rem;
                display: flex;
                flex-direction: column;
            }
            /* Transition styles */
            .fade-enter { opacity: 0; transform: translateX(20px); transition: all 0.5s ease; }
            .fade-enter-active { opacity: 1; transform: translateX(0); }
        </style>
    </head>
    <body>
        <div id="slide-container"></div>

        <!-- Navigation Controls -->
        <div class="fixed bottom-4 right-4 flex gap-2">
            <button onclick="prevSlide()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <button onclick="nextSlide()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </div>

        <script>
            const slides = ${slidesData};
            let currentIndex = 0;
            const container = document.getElementById('slide-container');

            function renderSlide(index) {
                if (index < 0) index = 0;
                if (index >= slides.length) index = slides.length - 1;
                currentIndex = index;
                
                // Simple fade replacement
                container.style.opacity = '0';
                
                setTimeout(() => {
                    container.innerHTML = '<div class="slide-content">' + slides[currentIndex] + '</div>';
                    container.style.opacity = '1';
                }, 200);
            }

            function nextSlide() {
                if (currentIndex < slides.length - 1) renderSlide(currentIndex + 1);
            }

            function prevSlide() {
                if (currentIndex > 0) renderSlide(currentIndex - 1);
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
                if (e.key === 'ArrowLeft') prevSlide();
            });

            // Init
            renderSlide(0);
        </script>
    </body>
</html>
    `;
}