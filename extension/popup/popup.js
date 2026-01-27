// AI 全媒体发布助手 - Popup 脚本

document.addEventListener('DOMContentLoaded', async () => {
  // 检查待发布文章
  chrome.storage.local.get('pending_article', (data) => {
    const el = document.getElementById('pendingArticle');
    if (data.pending_article) {
      el.textContent = data.pending_article.title.substring(0, 20) + '...';
      el.classList.add('connected');
    } else {
      el.textContent = '无';
    }
  });

  // 平台点击事件
  document.querySelectorAll('.platform-item').forEach(item => {
    item.addEventListener('click', () => {
      const platform = item.dataset.platform;
      const urls = {
        wechat: 'https://mp.weixin.qq.com/',
        zhihu: 'https://zhuanlan.zhihu.com/write',
        xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish',
        toutiao: 'https://mp.toutiao.com/profile_v4/graphic/publish'
      };
      chrome.tabs.create({ url: urls[platform] });
    });
  });
});
