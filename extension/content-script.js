// AI 全媒体发布助手 - Content Script
// 注入到目标平台页面，执行 AI 驱动的自动化操作

(function() {
  'use strict';

  // 加载依赖模块
  const loadScript = (src) => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // DOM 提取器（内联版本，避免模块加载问题）
  class DOMExtractor {
    constructor() {
      this.elementMap = new Map();
      this.idCounter = 0;
    }

    generateId() {
      return `elem_${++this.idCounter}`;
    }

    extract() {
      this.elementMap.clear();
      this.idCounter = 0;

      const snapshot = {
        url: window.location.href,
        title: document.title,
        interactiveElements: [],
        pageHints: this.extractPageHints()
      };

      this.extractFromDocument(document, snapshot.interactiveElements);
      this.extractFromIframes(snapshot.interactiveElements);

      return snapshot;
    }

    extractFromDocument(doc, elements, iframePath = '') {
      const selectors = [
        'input:not([type="hidden"])',
        'textarea',
        'button',
        '[contenteditable="true"]',
        '[role="textbox"]',
        '[role="button"]',
        '.ql-editor', '.ProseMirror', '.edui-editor', '.w-e-text',
        '[data-slate-editor]', '.CodeMirror',
        '[class*="editor"]', '[class*="title"]', '[class*="content"]',
        '[id*="title"]', '[id*="content"]', '[id*="editor"]'
      ];

      try {
        const allElements = doc.querySelectorAll(selectors.join(','));
        allElements.forEach(el => {
          if (!this.isVisible(el)) return;
          const info = this.extractElementInfo(el, iframePath);
          if (info) elements.push(info);
        });
      } catch (e) {
        console.warn('[DOMExtractor] 提取失败:', e);
      }
    }

    extractFromIframes(elements) {
      document.querySelectorAll('iframe').forEach((iframe, index) => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (iframeDoc) {
            this.extractFromDocument(iframeDoc, elements, `iframe_${index}`);
          }
        } catch (e) {}
      });
    }

    extractElementInfo(el, iframePath = '') {
      const id = this.generateId();
      this.elementMap.set(id, { element: el, iframePath });

      const rect = el.getBoundingClientRect();
      return {
        id,
        iframePath,
        tagName: el.tagName.toLowerCase(),
        type: el.getAttribute('type') || undefined,
        placeholder: el.getAttribute('placeholder') || undefined,
        label: this.findLabel(el),
        ariaLabel: el.getAttribute('aria-label') || undefined,
        className: el.className?.toString?.() || '',
        innerText: (el.innerText || el.textContent || el.value || '').trim().substring(0, 100),
        name: el.getAttribute('name') || undefined,
        isEditable: this.isEditable(el),
        isContentEditable: el.isContentEditable || el.getAttribute('contenteditable') === 'true',
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        role: el.getAttribute('role') || undefined
      };
    }

    isVisible(el) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    }

    isEditable(el) {
      return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || 
             el.isContentEditable || el.getAttribute('contenteditable') === 'true' ||
             el.getAttribute('role') === 'textbox';
    }

    findLabel(el) {
      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return label.textContent?.trim();
      }
      const parentLabel = el.closest('label');
      if (parentLabel) return parentLabel.textContent?.trim();
      return undefined;
    }

    extractPageHints() {
      const hints = [];
      const text = document.body?.innerText?.toLowerCase() || '';
      if (text.includes('微信公众平台') || text.includes('公众号')) hints.push('wechat_platform');
      if (text.includes('知乎')) hints.push('zhihu_platform');
      if (text.includes('小红书')) hints.push('xiaohongshu_platform');
      if (text.includes('头条')) hints.push('toutiao_platform');
      return hints;
    }

    getElementById(id) {
      return this.elementMap.get(id);
    }
  }

  // 动作执行器（内联版本）
  class ActionExecutor {
    constructor(domExtractor) {
      this.domExtractor = domExtractor;
      this.logs = [];
    }

    log(message, type = 'info') {
      console.log(`[AI发布助手] ${type.toUpperCase()}: ${message}`);
      this.logs.push({ time: Date.now(), type, message });
    }

    async execute(steps, articleData) {
      this.log(`开始执行 ${steps.length} 个步骤`);
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        this.log(`步骤 ${i + 1}/${steps.length}: ${step.action} - ${step.reason}`);
        
        try {
          await this.executeStep(step, articleData);
          await this.sleep(step.delay || 300 + Math.random() * 200);
        } catch (error) {
          this.log(`步骤失败: ${error.message}`, 'error');
        }
      }
      
      this.log('执行完成');
      return this.logs;
    }

    async executeStep(step, articleData) {
      const elementInfo = this.domExtractor.getElementById(step.targetId);
      if (!elementInfo) throw new Error(`元素 ${step.targetId} 未找到`);
      
      const { element } = elementInfo;
      const value = this.replacePlaceholders(step.value, articleData);
      
      switch (step.action) {
        case 'fill': await this.fillInput(element, value); break;
        case 'click': await this.simulateClick(element); break;
        case 'paste': await this.pasteContent(element, value); break;
        case 'focus': await this.focusElement(element); break;
        case 'wait': await this.sleep(step.delay || 1000); break;
      }
    }

    replacePlaceholders(value, data) {
      if (!value) return value;
      return value.replace('{{title}}', data.title || '').replace('{{content}}', data.content || '');
    }

    async fillInput(el, value) {
      el.focus();
      await this.sleep(100);
      
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value = '';
        for (const char of value) {
          el.value += char;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          await this.sleep(15);
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (el.isContentEditable) {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, value);
      }
    }

    async simulateClick(el) {
      el.focus();
      ['mousedown', 'mouseup', 'click'].forEach(type => {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
      });
    }

    async pasteContent(el, html) {
      el.focus();
      await this.sleep(100);
      
      // 尝试多种粘贴方式
      let success = document.execCommand('insertHTML', false, html);
      
      if (!success && el.isContentEditable) {
        el.innerHTML = html;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    async focusElement(el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(300);
      el.focus();
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // 主逻辑
  async function main() {
    console.log('[AI发布助手] Content Script 已加载');
    
    // 等待页面完全加载
    await new Promise(resolve => {
      if (document.readyState === 'complete') resolve();
      else window.addEventListener('load', resolve);
    });
    
    // 额外等待动态内容加载
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 检查是否有待发布的文章
    chrome.runtime.sendMessage({ type: 'GET_PENDING_ARTICLE' }, async (article) => {
      if (!article) {
        console.log('[AI发布助手] 没有待发布的文章');
        return;
      }
      
      console.log('[AI发布助手] 检测到待发布文章:', article.title);
      
      // 显示状态提示
      showStatusOverlay('正在分析页面结构...');
      
      try {
        // 1. 提取 DOM 快照
        const extractor = new DOMExtractor();
        const snapshot = extractor.extract();
        console.log('[AI发布助手] DOM 快照:', snapshot);
        
        // 2. 调用 AI 分析
        showStatusOverlay('AI 正在分析页面元素...');
        const aiResult = await analyzeWithAI(snapshot, article);
        console.log('[AI发布助手] AI 分析结果:', aiResult);
        
        if (aiResult.confidence < 0.5) {
          showStatusOverlay('⚠️ AI 置信度较低，请手动操作', 'warning');
          return;
        }
        
        // 3. 执行操作
        showStatusOverlay(`正在自动填充 (${aiResult.steps.length} 个步骤)...`);
        const executor = new ActionExecutor(extractor);
        await executor.execute(aiResult.steps, article);
        
        // 4. 完成
        showStatusOverlay('✅ 内容已填充，请检查后手动发布', 'success');
        
        // 清除待发布数据
        chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ARTICLE' });
        
      } catch (error) {
        console.error('[AI发布助手] 错误:', error);
        showStatusOverlay(`❌ 操作失败: ${error.message}`, 'error');
      }
    });
  }

  // 调用 AI 分析页面 - 支持多服务商
  async function analyzeWithAI(snapshot, article) {
    const prompt = buildPrompt(snapshot, article);
    const { apiKey, provider, model } = article;
    
    let response, data, text;
    
    if (provider === 'deepseek') {
      // DeepSeek API (OpenAI 兼容)
      response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'deepseek-chat',
          messages: [
            { role: 'system', content: '你是一个网页自动化助手，返回 JSON 格式的操作步骤。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) throw new Error(`DeepSeek API 错误: ${response.status}`);
      data = await response.json();
      text = data.choices?.[0]?.message?.content;
      
    } else if (provider === 'glm') {
      // GLM 智谱 API
      response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'glm-4-flash',
          messages: [
            { role: 'system', content: '你是一个网页自动化助手，返回 JSON 格式的操作步骤。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
        })
      });
      
      if (!response.ok) throw new Error(`GLM API 错误: ${response.status}`);
      data = await response.json();
      text = data.choices?.[0]?.message?.content;
      
    } else {
      // Gemini API (默认)
      response = await fetch(
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
      
      if (!response.ok) throw new Error(`Gemini API 错误: ${response.status}`);
      data = await response.json();
      text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    }
    
    console.log('[AI发布助手] AI 返回:', text);
    return JSON.parse(text);
  }

  // 构建 AI Prompt
  function buildPrompt(snapshot, article) {
    // 精简元素信息，只保留关键字段
    const simplifiedElements = snapshot.interactiveElements.map(el => ({
      id: el.id,
      tag: el.tagName,
      type: el.type,
      placeholder: el.placeholder,
      label: el.label,
      class: el.className.substring(0, 100),
      text: el.innerText,
      editable: el.isEditable,
      contentEditable: el.isContentEditable
    }));

    return `你是一个网页自动化助手。用户想在当前页面发布一篇文章。

## 用户要发布的内容
标题：${article.title}
正文预览：${article.content.substring(0, 300)}...

## 当前页面
URL: ${snapshot.url}
页面标题: ${snapshot.title}
页面提示: ${snapshot.pageHints.join(', ')}

## 页面交互元素 (共 ${simplifiedElements.length} 个)
${JSON.stringify(simplifiedElements, null, 2)}

## 任务
分析页面，找出：
1. 标题输入框（通常是 input 或有 title 相关类名/placeholder）
2. 正文编辑器（通常是 contenteditable 的 div 或 textarea）

返回操作步骤 JSON：
{
  "pageType": "wechat_editor" | "zhihu_editor" | "xiaohongshu_editor" | "toutiao_editor" | "unknown",
  "confidence": 0.0-1.0,
  "steps": [
    { "action": "fill", "targetId": "elem_X", "value": "{{title}}", "reason": "标题输入框", "delay": 300 },
    { "action": "focus", "targetId": "elem_Y", "reason": "聚焦编辑器", "delay": 200 },
    { "action": "paste", "targetId": "elem_Y", "value": "{{content}}", "reason": "粘贴正文", "delay": 500 }
  ],
  "warnings": []
}

注意：
- targetId 必须是上面元素列表中的 id
- 优先选择 editable=true 或 contentEditable=true 的元素
- 如果找不到合适的元素，confidence 设为 0`;
  }

  // 显示状态覆盖层
  function showStatusOverlay(message, type = 'info') {
    let overlay = document.getElementById('ai-publish-overlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'ai-publish-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: all 0.3s ease;
      `;
      document.body.appendChild(overlay);
    }
    
    const colors = {
      info: { bg: '#1890ff', text: '#fff' },
      success: { bg: '#52c41a', text: '#fff' },
      warning: { bg: '#faad14', text: '#000' },
      error: { bg: '#ff4d4f', text: '#fff' }
    };
    
    const color = colors[type] || colors.info;
    overlay.style.backgroundColor = color.bg;
    overlay.style.color = color.text;
    overlay.textContent = message;
    
    // 成功或错误时 5 秒后自动隐藏
    if (type === 'success' || type === 'error') {
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
      }, 5000);
    }
  }

  // 启动
  main();
})();
