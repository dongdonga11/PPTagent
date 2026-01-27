// DOM 快照提取器 - 智能提取页面交互元素
// 不是把整个 HTML 发给 AI，而是提取关键信息

class DOMExtractor {
  constructor() {
    this.elementMap = new Map(); // id → Element 映射
    this.idCounter = 0;
  }

  // 生成唯一 ID
  generateId() {
    return `elem_${++this.idCounter}`;
  }

  // 提取页面快照
  extract() {
    this.elementMap.clear();
    this.idCounter = 0;

    const snapshot = {
      url: window.location.href,
      title: document.title,
      interactiveElements: [],
      pageHints: this.extractPageHints()
    };

    // 提取主文档的交互元素
    this.extractFromDocument(document, snapshot.interactiveElements);

    // 提取 iframe 内的元素
    this.extractFromIframes(snapshot.interactiveElements);

    return snapshot;
  }

  // 从文档中提取交互元素
  extractFromDocument(doc, elements, iframePath = '') {
    // 选择器：所有可能的交互元素
    const selectors = [
      'input:not([type="hidden"])',
      'textarea',
      'button',
      '[contenteditable="true"]',
      '[role="textbox"]',
      '[role="button"]',
      '.ql-editor',           // Quill 编辑器
      '.ProseMirror',         // ProseMirror 编辑器
      '.edui-editor',         // UEditor
      '.w-e-text',            // wangEditor
      '[data-slate-editor]',  // Slate 编辑器
      '.CodeMirror',          // CodeMirror
      '[class*="editor"]',    // 通用编辑器类名
      '[class*="title"]',     // 标题相关
      '[class*="content"]',   // 内容相关
      '[id*="title"]',
      '[id*="content"]',
      '[id*="editor"]'
    ];

    try {
      const allElements = doc.querySelectorAll(selectors.join(','));
      
      allElements.forEach(el => {
        if (!this.isVisible(el)) return;
        if (this.isInsideHiddenParent(el)) return;

        const info = this.extractElementInfo(el, iframePath);
        if (info) {
          elements.push(info);
        }
      });
    } catch (e) {
      console.warn('[DOMExtractor] 提取失败:', e);
    }
  }

  // 提取 iframe 内的元素
  extractFromIframes(elements) {
    const iframes = document.querySelectorAll('iframe');
    
    iframes.forEach((iframe, index) => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          this.extractFromDocument(iframeDoc, elements, `iframe_${index}`);
        }
      } catch (e) {
        // 跨域 iframe 无法访问，跳过
        console.warn('[DOMExtractor] 无法访问 iframe:', e.message);
      }
    });
  }

  // 提取单个元素信息
  extractElementInfo(el, iframePath = '') {
    const id = this.generateId();
    this.elementMap.set(id, { element: el, iframePath });

    const rect = el.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(el);

    return {
      id,
      iframePath,
      tagName: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      label: this.findLabel(el),
      ariaLabel: el.getAttribute('aria-label') || undefined,
      className: el.className?.toString?.() || '',
      innerText: this.getInnerText(el),
      name: el.getAttribute('name') || undefined,
      isEditable: this.isEditable(el),
      isContentEditable: el.isContentEditable || el.getAttribute('contenteditable') === 'true',
      isVisible: true,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height)
      },
      xpath: this.getXPath(el),
      // 额外的语义信息
      role: el.getAttribute('role') || undefined,
      dataAttributes: this.getDataAttributes(el)
    };
  }

  // 检查元素是否可见
  isVisible(el) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    
    return true;
  }

  // 检查是否在隐藏的父元素内
  isInsideHiddenParent(el) {
    let parent = el.parentElement;
    while (parent) {
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  // 检查元素是否可编辑
  isEditable(el) {
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    if (el.getAttribute('contenteditable') === 'true') return true;
    if (el.getAttribute('role') === 'textbox') return true;
    return false;
  }

  // 查找关联的 label
  findLabel(el) {
    // 通过 id 查找
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim();
    }
    
    // 查找父级 label
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim();
    
    // 查找相邻的 label
    const prev = el.previousElementSibling;
    if (prev?.tagName === 'LABEL') return prev.textContent?.trim();
    
    return undefined;
  }

  // 获取元素文本（限制长度）
  getInnerText(el) {
    const text = el.innerText || el.textContent || el.value || '';
    return text.trim().substring(0, 100);
  }

  // 获取 XPath
  getXPath(el) {
    const parts = [];
    let current = el;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;
      
      while (sibling) {
        if (sibling.tagName === current.tagName) index++;
        sibling = sibling.previousElementSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      parts.unshift(`${tagName}[${index}]`);
      current = current.parentElement;
    }
    
    return '/' + parts.join('/');
  }

  // 获取 data-* 属性
  getDataAttributes(el) {
    const data = {};
    for (const attr of el.attributes) {
      if (attr.name.startsWith('data-')) {
        data[attr.name] = attr.value;
      }
    }
    return Object.keys(data).length > 0 ? data : undefined;
  }

  // 提取页面语义提示
  extractPageHints() {
    const hints = [];
    const text = document.body?.innerText?.toLowerCase() || '';
    
    if (text.includes('微信公众平台') || text.includes('公众号')) {
      hints.push('wechat_platform');
    }
    if (text.includes('知乎') || text.includes('zhuanlan')) {
      hints.push('zhihu_platform');
    }
    if (text.includes('小红书') || text.includes('xiaohongshu')) {
      hints.push('xiaohongshu_platform');
    }
    if (text.includes('头条') || text.includes('toutiao')) {
      hints.push('toutiao_platform');
    }
    if (text.includes('图文') || text.includes('文章')) {
      hints.push('article_editor');
    }
    
    return hints;
  }

  // 根据 ID 获取元素
  getElementById(id) {
    return this.elementMap.get(id);
  }
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = DOMExtractor;
}
