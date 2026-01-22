import { GoogleGenAI, Type } from "@google/genai";
import { Slide, GlobalStyle } from "../types";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is missing from environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// --- AGENT A: PLANNER & SCRIPTWRITER ---
export const generatePresentationOutline = async (userInput: string): Promise<any[]> => {
  const ai = getAiClient();
  
  const systemPrompt = `
    你是一个全能的内容架构师。
    你的目标是分析用户的请求，生成演示文稿的结构化大纲，并**为每一页编写视频旁白脚本**。
    
    规则：
    1. 创建符合逻辑的流程（建议 5-8 页）。
    2. 'visual_intent'：描述画面布局（如“左文右图”）。
    3. **'narration' (关键)**：编写该页面的逐字演讲稿/视频旁白。口语化、自然、有吸引力。长度应适中（约 30-60 字）。
    4. 'duration'：根据旁白长度预估时长（秒）。
    5. 'speaker_notes'：给演讲者的提示（不同于旁白）。
    6. **所有内容必须使用简体中文。**
    
    输出格式：JSON 对象数组。
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
            narration: { type: Type.STRING, description: "Video voiceover script for this slide" },
            duration: { type: Type.NUMBER, description: "Estimated duration in seconds" }
          },
          required: ["title", "visual_intent", "speaker_notes", "narration", "duration"],
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
    Narration Context: ${slide.narration}
    Global Style: Main Color: ${globalStyle.mainColor}, Accent: ${globalStyle.accentColor}.

    ${context ? `USER REFINEMENT INSTRUCTION: ${context}` : ''}
  `;

  const systemPrompt = `
    你是一个精通 Tailwind CSS 和动画编排的前端专家。
    你的任务：生成单个幻灯片的内容 HTML。
    
    核心布局规则：
    1. **结构容器**：最外层必须是一个 \`<div class="w-full h-full flex flex-col ...">\`。
    2. **16:9 适配**：内容将在一个固定比例（16:9）的容器中渲染。
    3. **字号策略**：标题(text-5xl+), 正文(text-2xl+)。
    4. **颜色使用**：使用 style="color: ${globalStyle.accentColor}" 高亮。
    
    🌟 关键：动画编排 (Motion Choreography) 🌟
    你必须充当“动画导演”。请为页面上的关键元素添加 \`data-motion\` 属性，以便播放器按顺序播放动画。
    
    可用动画类型 (data-motion):
    - "fade-up": 适用于标题、段落 (向上淡入)
    - "fade-in": 适用于背景图、大图 (渐显)
    - "zoom-in": 适用于强调的数据、图标、核心卡片 (缩放出现)
    - "slide-right": 适用于列表项、步骤条 (从左侧滑入)
    
    规则：
    1. 给主标题添加 \`data-motion="fade-up"\`。
    2. 给列表项 (li) 或卡片 (div) 添加 \`data-motion="slide-right"\` 或 \`data-motion="fade-up"\`。
    3. 这里的动画由外部 JS 控制，你**不需要**写 keyframes 或 style 动画代码，只需要打上 data 标签即可。
    4. **不要**添加 opacity-0 类，播放器会自动处理初始状态。
    
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
                max-width: 1280px; 
                aspect-ratio: 16/9;
                padding: 2rem;
                display: flex;
                flex-direction: column;
            }
            
            /* Animation States */
            [data-motion] {
                opacity: 0;
                transition: all 0.5s ease-out;
            }
            
            /* Active States */
            .animate-active[data-motion="fade-up"] { opacity: 1; transform: translateY(0); }
            [data-motion="fade-up"] { transform: translateY(30px); }

            .animate-active[data-motion="fade-in"] { opacity: 1; }
            
            .animate-active[data-motion="zoom-in"] { opacity: 1; transform: scale(1); }
            [data-motion="zoom-in"] { transform: scale(0.8); }

            .animate-active[data-motion="slide-right"] { opacity: 1; transform: translateX(0); }
            [data-motion="slide-right"] { transform: translateX(-30px); }
        </style>
    </head>
    <body>
        <div id="slide-container"></div>

        <div class="fixed bottom-4 right-4 flex gap-2">
            <button onclick="prevStep()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded"><i class="fa-solid fa-chevron-left"></i></button>
            <button onclick="nextStep()" class="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded"><i class="fa-solid fa-chevron-right"></i></button>
        </div>

        <script>
            const slides = ${slidesData};
            let currentIndex = 0;
            let currentStep = 0; // Animation step
            const container = document.getElementById('slide-container');

            function updateAnimations() {
                const elements = container.querySelectorAll('[data-motion]');
                elements.forEach((el, index) => {
                    if (index < currentStep) {
                        el.classList.add('animate-active');
                    } else {
                        el.classList.remove('animate-active');
                    }
                });
            }

            function renderSlide(index) {
                if (index < 0) index = 0;
                if (index >= slides.length) index = slides.length - 1;
                currentIndex = index;
                currentStep = 0; // Reset animation step on slide change
                
                container.style.opacity = '0';
                setTimeout(() => {
                    container.innerHTML = '<div class="slide-content">' + slides[currentIndex] + '</div>';
                    container.style.opacity = '1';
                    // Initially hide everything (currentStep is 0)
                    updateAnimations();
                }, 200);
            }

            function nextStep() {
                const elements = container.querySelectorAll('[data-motion]');
                if (currentStep < elements.length) {
                    currentStep++;
                    updateAnimations();
                } else if (currentIndex < slides.length - 1) {
                    renderSlide(currentIndex + 1);
                }
            }

            function prevStep() {
                if (currentStep > 0) {
                    currentStep--;
                    updateAnimations();
                } else if (currentIndex > 0) {
                    // Go to previous slide (reset to beginning of that slide for simplicity, or we could go to end)
                    renderSlide(currentIndex - 1);
                }
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === ' ') nextStep();
                if (e.key === 'ArrowLeft') prevStep();
            });

            renderSlide(0);
        </script>
    </body>
</html>
    `;
}