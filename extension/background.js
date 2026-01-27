// AI 全媒体发布助手 - Background Service Worker
// 负责消息中转、Tab 管理、数据缓存

// 平台配置
const PLATFORM_URLS = {
  wechat: 'https://mp.weixin.qq.com/',
  zhihu: 'https://zhuanlan.zhihu.com/write',
  xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish',
  toutiao: 'https://mp.toutiao.com/profile_v4/graphic/publish'
};

// 监听来自 React 网页的消息
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('[Background] 收到外部消息:', message.type);
  
  if (message.type === 'PREPARE_PUBLISH') {
    handlePreparePublish(message.payload, sendResponse);
    return true; // 保持消息通道开放
  }
  
  if (message.type === 'CHECK_EXTENSION') {
    sendResponse({ installed: true, version: chrome.runtime.getManifest().version });
    return true;
  }
});

// 监听来自 Content Script 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Background] 收到内部消息:', message.type);
  
  if (message.type === 'GET_PENDING_ARTICLE') {
    chrome.storage.local.get('pending_article', (data) => {
      sendResponse(data.pending_article || null);
    });
    return true;
  }
  
  if (message.type === 'CLEAR_PENDING_ARTICLE') {
    chrome.storage.local.remove('pending_article', () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (message.type === 'AI_ANALYZE_REQUEST') {
    // 转发 AI 分析请求到 React 端（如果需要）
    // 或者直接在这里调用 AI API
    handleAIAnalyze(message.payload, sendResponse);
    return true;
  }
});

// 处理发布准备
async function handlePreparePublish(payload, sendResponse) {
  const { title, content, platform, apiKey, provider, model } = payload;
  
  // 存储文章数据和 API 配置
  await chrome.storage.local.set({
    pending_article: {
      title,
      content,
      platform,
      apiKey,
      provider: provider || 'gemini',
      model: model || '',
      timestamp: Date.now()
    }
  });
  
  // 获取目标 URL
  const targetUrl = PLATFORM_URLS[platform];
  if (!targetUrl) {
    sendResponse({ success: false, error: '不支持的平台' });
    return;
  }
  
  // 创建新 Tab
  chrome.tabs.create({ url: targetUrl }, (tab) => {
    sendResponse({ success: true, tabId: tab.id });
  });
}

// 处理 AI 分析请求
async function handleAIAnalyze(payload, sendResponse) {
  const { domSnapshot, articleInfo, apiKey } = payload;
  
  try {
    const result = await callGeminiAPI(domSnapshot, articleInfo, apiKey);
    sendResponse({ success: true, steps: result });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// 调用 Gemini API 分析页面
async function callGeminiAPI(domSnapshot, articleInfo, apiKey) {
  const prompt = buildAnalyzerPrompt(domSnapshot, articleInfo);
  
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3
        }
      })
    }
  );
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(text);
}

// 构建 AI 分析 Prompt
function buildAnalyzerPrompt(domSnapshot, articleInfo) {
  return `你是一个网页自动化助手。用户想在当前页面发布一篇文章。

## 用户要发布的内容
标题：${articleInfo.title}
正文预览：${articleInfo.content.substring(0, 500)}...

## 当前页面信息
URL: ${domSnapshot.url}
页面标题: ${domSnapshot.title}

## 页面交互元素
${JSON.stringify(domSnapshot.interactiveElements, null, 2)}

## 你的任务
分析页面结构，返回操作步骤。每个步骤包含：
1. action: "fill" | "click" | "paste" | "wait" | "focus"
2. targetId: 元素的 id（来自快照）
3. value: 要填入的值（fill/paste 时需要，使用 {{title}} 或 {{content}} 占位符）
4. reason: 为什么选择这个元素
5. delay: 操作后等待的毫秒数（可选）

## 输出格式 (JSON)
{
  "pageType": "wechat_editor" | "zhihu_editor" | "xiaohongshu_editor" | "toutiao_editor" | "unknown",
  "confidence": 0.0-1.0,
  "steps": [
    { "action": "fill", "targetId": "elem_3", "value": "{{title}}", "reason": "标题输入框", "delay": 300 },
    { "action": "focus", "targetId": "elem_7", "reason": "聚焦编辑器" },
    { "action": "paste", "targetId": "elem_7", "value": "{{content}}", "reason": "富文本编辑器" }
  ],
  "warnings": ["可能需要手动处理的问题"]
}`;
}
