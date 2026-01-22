
export interface WechatTheme {
    id: string;
    name: string;
    colors: {
        primary: string;
        secondary: string;
        text: string;
        background: string;
    };
    styles: {
        h1: string;
        h2: string;
        h3: string;
        p: string;
        blockquote: string;
        li: string;
        strong: string;
    }
}

export const THEMES: Record<string, WechatTheme> = {
    'default': {
        id: 'default',
        name: '简约黑白',
        colors: {
            primary: '#333',
            secondary: '#f7f7f7',
            text: '#333',
            background: '#fff'
        },
        styles: {
            h1: 'font-size: 22px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #333; padding-bottom: 5px;',
            h2: 'font-size: 18px; font-weight: bold; margin-top: 25px; margin-bottom: 10px; padding-left: 10px; border-left: 4px solid #333;',
            h3: 'font-size: 16px; font-weight: bold; margin-top: 20px; color: #555;',
            p: 'font-size: 15px; line-height: 1.75; margin-bottom: 15px; color: #333; text-align: justify;',
            blockquote: 'border-left: 4px solid #ddd; background-color: #f9f9f9; color: #666; padding: 10px 15px; margin: 15px 0; font-size: 14px;',
            li: 'margin-bottom: 5px; font-size: 15px; line-height: 1.75;',
            strong: 'color: #000; font-weight: bold;'
        }
    },
    'kaoxing': {
        id: 'kaoxing',
        name: '考星蓝绿',
        colors: {
            primary: '#00b96b',
            secondary: '#f2fcf6',
            text: '#333',
            background: '#fff'
        },
        styles: {
            h1: 'font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 20px; text-align: center; color: #00b96b;',
            h2: 'font-size: 17px; font-weight: bold; margin-top: 25px; margin-bottom: 15px; display: inline-block; background: #f2fcf6; color: #00b96b; padding: 6px 15px; border-radius: 4px;',
            h3: 'font-size: 16px; font-weight: bold; margin-top: 20px; padding-left: 8px; border-left: 3px solid #00b96b; line-height: 1.2;',
            p: 'font-size: 15px; line-height: 1.8; margin-bottom: 20px; color: #3f3f3f; text-align: justify; letter-spacing: 0.5px;',
            blockquote: 'border-radius: 8px; background-color: #f2fcf6; color: #00b96b; padding: 15px; margin: 15px 0; font-size: 15px; line-height: 1.6;',
            li: 'margin-bottom: 8px; font-size: 15px; line-height: 1.8;',
            strong: 'color: #00b96b; font-weight: bold;'
        }
    },
    'tech': {
        id: 'tech',
        name: '极客科技',
        colors: {
            primary: '#2563eb',
            secondary: '#eff6ff',
            text: '#1e293b',
            background: '#fff'
        },
        styles: {
            h1: 'font-size: 24px; font-weight: 800; margin-top: 35px; margin-bottom: 20px; color: #2563eb; letter-spacing: -0.5px;',
            h2: 'font-size: 18px; font-weight: 700; margin-top: 25px; margin-bottom: 12px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;',
            h3: 'font-size: 16px; font-weight: 600; margin-top: 20px; color: #2563eb;',
            p: 'font-size: 16px; line-height: 1.8; margin-bottom: 20px; color: #334155;',
            blockquote: 'border-left: 4px solid #2563eb; background: #f1f5f9; padding: 12px 16px; color: #475569; font-style: italic;',
            li: 'margin-bottom: 6px; font-size: 16px; color: #334155;',
            strong: 'color: #2563eb; font-weight: 700; background: #eff6ff; padding: 0 4px; border-radius: 2px;'
        }
    }
};

/**
 * Transforms standard HTML into WeChat-compatible inline-styled HTML
 */
export const transformToWechatHtml = (html: string, themeId: string = 'default'): string => {
    const theme = THEMES[themeId] || THEMES['default'];
    
    // Create a temporary DOM element to manipulate
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;

    // Helper to apply styles
    const applyStyle = (selector: string, styleString: string) => {
        const elements = wrapper.querySelectorAll(selector);
        elements.forEach(el => {
            // Append to existing styles if any
            const existing = el.getAttribute('style') || '';
            el.setAttribute('style', existing + '; ' + styleString);
        });
    };

    // Apply styles based on theme definition
    applyStyle('h1', theme.styles.h1);
    applyStyle('h2', theme.styles.h2);
    applyStyle('h3', theme.styles.h3);
    applyStyle('p', theme.styles.p);
    applyStyle('blockquote', theme.styles.blockquote);
    applyStyle('li', theme.styles.li);
    applyStyle('strong', theme.styles.strong);
    applyStyle('b', theme.styles.strong);

    // Handle images (ensure width is 100%)
    applyStyle('img', 'max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 10px auto;');
    
    // Handle container needed for WeChat (optional, but good for global font settings)
    const containerStyle = `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: ${theme.colors.text};`;
    
    return `<div style="${containerStyle}" id="wechat-content">${wrapper.innerHTML}</div>`;
};

// Helper to extract Outline from HTML
export const extractOutline = (html: string) => {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    const headers = wrapper.querySelectorAll('h1, h2, h3');
    return Array.from(headers).map((h, index) => ({
        id: `header-${index}`,
        level: parseInt(h.tagName.substring(1)),
        text: h.textContent || ''
    }));
};
