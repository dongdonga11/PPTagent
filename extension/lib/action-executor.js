// 动作执行器 - 根据 AI 返回的步骤执行实际操作

class ActionExecutor {
  constructor(domExtractor) {
    this.domExtractor = domExtractor;
    this.logs = [];
  }

  log(message, type = 'info') {
    const entry = { time: new Date().toISOString(), type, message };
    this.logs.push(entry);
    console.log(`[ActionExecutor] ${type.toUpperCase()}: ${message}`);
  }

  // 执行所有步骤
  async execute(steps, articleData) {
    this.log(`开始执行 ${steps.length} 个步骤`);
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this.log(`步骤 ${i + 1}/${steps.length}: ${step.action} - ${step.reason}`);
      
      try {
        await this.executeStep(step, articleData);
        
        // 步骤间延迟
        const delay = step.delay || 300 + Math.random() * 200;
        await this.sleep(delay);
        
      } catch (error) {
        this.log(`步骤 ${i + 1} 失败: ${error.message}`, 'error');
        // 继续执行下一步，不中断
      }
    }
    
    this.log('所有步骤执行完成');
    return this.logs;
  }

  // 执行单个步骤
  async executeStep(step, articleData) {
    const { action, targetId, value } = step;
    
    // 获取目标元素
    const elementInfo = this.domExtractor.getElementById(targetId);
    if (!elementInfo) {
      throw new Error(`元素 ${targetId} 未找到`);
    }
    
    const { element, iframePath } = elementInfo;
    
    // 替换占位符
    const actualValue = this.replacePlaceholders(value, articleData);
    
    switch (action) {
      case 'fill':
        await this.fillInput(element, actualValue);
        break;
      case 'click':
        await this.simulateClick(element);
        break;
      case 'paste':
        await this.pasteContent(element, actualValue);
        break;
      case 'focus':
        await this.focusElement(element);
        break;
      case 'wait':
        await this.sleep(step.delay || 1000);
        break;
      default:
        this.log(`未知操作: ${action}`, 'warn');
    }
  }

  // 替换占位符
  replacePlaceholders(value, articleData) {
    if (!value) return value;
    return value
      .replace('{{title}}', articleData.title || '')
      .replace('{{content}}', articleData.content || '');
  }

  // 填充输入框
  async fillInput(el, value) {
    // 先聚焦
    el.focus();
    await this.sleep(100);
    
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      // 清空现有内容
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      
      // 模拟逐字输入（更像人类）
      for (const char of value) {
        el.value += char;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        await this.sleep(10 + Math.random() * 20);
      }
      
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      
    } else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      // contenteditable 元素
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, value);
    }
    
    this.log(`填充完成: ${value.substring(0, 50)}...`);
  }

  // 模拟点击
  async simulateClick(el) {
    el.focus();
    
    // 创建鼠标事件序列
    const events = ['mouseenter', 'mouseover', 'mousedown', 'mouseup', 'click'];
    
    for (const eventType of events) {
      const event = new MouseEvent(eventType, {
        bubbles: true,
        cancelable: true,
        view: window
      });
      el.dispatchEvent(event);
      await this.sleep(50);
    }
    
    this.log('点击完成');
  }

  // 粘贴内容（用于富文本编辑器）
  async pasteContent(el, htmlContent) {
    el.focus();
    await this.sleep(100);
    
    // 方案 1: 尝试 execCommand insertHTML
    let success = false;
    try {
      document.execCommand('selectAll', false, null);
      success = document.execCommand('insertHTML', false, htmlContent);
    } catch (e) {
      this.log('execCommand 失败，尝试其他方案', 'warn');
    }
    
    if (!success) {
      // 方案 2: 模拟剪贴板粘贴事件
      try {
        const clipboardData = new DataTransfer();
        clipboardData.setData('text/html', htmlContent);
        clipboardData.setData('text/plain', this.stripHTML(htmlContent));
        
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboardData
        });
        
        el.dispatchEvent(pasteEvent);
        success = true;
      } catch (e) {
        this.log('ClipboardEvent 失败', 'warn');
      }
    }
    
    if (!success) {
      // 方案 3: 直接设置 innerHTML（最后手段）
      if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
        el.innerHTML = htmlContent;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
    
    this.log('粘贴完成');
  }

  // 聚焦元素
  async focusElement(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.sleep(300);
    el.focus();
    el.click();
    this.log('聚焦完成');
  }

  // 去除 HTML 标签
  stripHTML(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // 延迟
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 导出
if (typeof module !== 'undefined') {
  module.exports = ActionExecutor;
}
