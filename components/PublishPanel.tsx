// 跨平台发布面板 - AI 驱动的一键多平台发布
import React, { useState, useEffect } from 'react';

// Chrome Extension API 类型声明
declare const chrome: {
  runtime: {
    sendMessage: (extensionId: string, message: any, callback?: (response: any) => void) => void;
    lastError?: { message: string };
  };
} | undefined;

interface PublishPanelProps {
  title: string;
  content: string; // HTML 内容
  onClose?: () => void;
}

interface Platform {
  id: string;
  name: string;
  icon: string;
  color: string;
  url: string;
}

const PLATFORMS: Platform[] = [
  { id: 'wechat', name: '微信公众号', icon: 'fab fa-weixin', color: '#07c160', url: 'https://mp.weixin.qq.com/' },
  { id: 'zhihu', name: '知乎专栏', icon: 'fab fa-zhihu', color: '#0084ff', url: 'https://zhuanlan.zhihu.com/write' },
  { id: 'xiaohongshu', name: '小红书', icon: 'fas fa-book', color: '#fe2c55', url: 'https://creator.xiaohongshu.com/' },
  { id: 'toutiao', name: '今日头条', icon: 'fas fa-newspaper', color: '#ff0000', url: 'https://mp.toutiao.com/' },
];

const EXTENSION_ID = 'genponjmpbohkfnbhjgmdehfonffckie'; // 安装后替换


const PublishPanel: React.FC<PublishPanelProps> = ({ title, content, onClose }) => {
  const [extensionInstalled, setExtensionInstalled] = useState<boolean | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // 检查插件是否安装
  useEffect(() => {
    checkExtension();
  }, []);

  const checkExtension = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      try {
        chrome.runtime.sendMessage(EXTENSION_ID, { type: 'CHECK_EXTENSION' }, (response) => {
          if (chrome.runtime.lastError) {
            setExtensionInstalled(false);
          } else {
            setExtensionInstalled(response?.installed || false);
          }
        });
      } catch {
        setExtensionInstalled(false);
      }
    } else {
      setExtensionInstalled(false);
    }
  };

  const handlePublish = async (platform: Platform) => {
    const apiKey = process.env.API_KEY;
    const provider = process.env.AI_PROVIDER || 'gemini';
    const model = provider === 'deepseek' ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat') 
                : provider === 'glm' ? (process.env.GLM_MODEL || 'glm-4-flash')
                : 'gemini-2.0-flash-exp';
    
    if (!apiKey) {
      setStatus('❌ 缺少 API Key');
      return;
    }

    if (!extensionInstalled) {
      // 降级方案：复制到剪贴板
      await copyToClipboard();
      window.open(platform.url, '_blank');
      setStatus(`📋 内容已复制，请在 ${platform.name} 手动粘贴`);
      return;
    }

    setPublishing(platform.id);
    setStatus(`正在准备发布到 ${platform.name}...`);

    try {
      chrome.runtime.sendMessage(EXTENSION_ID, {
        type: 'PREPARE_PUBLISH',
        payload: { title, content, platform: platform.id, apiKey, provider, model }
      }, (response) => {
        if (response?.success) {
          setStatus(`✅ 已跳转到 ${platform.name}，AI 正在自动填充...`);
        } else {
          setStatus(`❌ 发布失败: ${response?.error || '未知错误'}`);
        }
        setPublishing(null);
      });
    } catch (error) {
      setStatus(`❌ 发布失败: ${(error as Error).message}`);
      setPublishing(null);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([content], { type: 'text/html' }),
          'text/plain': new Blob([stripHTML(content)], { type: 'text/plain' })
        })
      ]);
    } catch {
      // 降级到纯文本
      await navigator.clipboard.writeText(stripHTML(content));
    }
  };

  const stripHTML = (html: string) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-xl w-[480px] max-h-[80vh] overflow-hidden border border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">一键多平台发布</h2>
            <p className="text-sm text-gray-400 mt-1">AI 自动识别页面元素并填充内容</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Content Preview */}
        <div className="px-6 py-4 border-b border-gray-800">
          <div className="text-sm text-gray-400 mb-2">待发布内容</div>
          <div className="bg-gray-800 rounded-lg p-3">
            <div className="font-medium text-white truncate">{title || '未命名文章'}</div>
            <div className="text-sm text-gray-500 mt-1">
              {stripHTML(content).substring(0, 100)}...
            </div>
          </div>
        </div>

        {/* Extension Status */}
        <div className="px-6 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${extensionInstalled ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span className="text-gray-400">
              {extensionInstalled === null ? '检测插件中...' : 
               extensionInstalled ? '插件已安装，支持自动填充' : '插件未安装，将使用剪贴板模式'}
            </span>
          </div>
        </div>

        {/* Platform Grid */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map(platform => (
              <button
                key={platform.id}
                onClick={() => handlePublish(platform)}
                disabled={publishing !== null}
                className={`flex items-center gap-3 p-4 rounded-lg border transition-all
                  ${publishing === platform.id 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800'}`}
              >
                <i className={`${platform.icon} text-2xl`} style={{ color: platform.color }}></i>
                <div className="text-left">
                  <div className="text-white font-medium">{platform.name}</div>
                  <div className="text-xs text-gray-500">
                    {publishing === platform.id ? '发布中...' : '点击发布'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className="px-6 py-3 border-t border-gray-800">
            <div className="text-sm text-center text-gray-300">{status}</div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-800/50">
          <div className="text-xs text-gray-500 text-center">
            {!extensionInstalled && (
              <span>
                <i className="fas fa-info-circle mr-1"></i>
                安装 Chrome 插件可启用 AI 自动填充功能
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublishPanel;
