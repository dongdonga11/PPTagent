# 项目启动指南

## 环境要求

- **Node.js**: 建议 18.x 或 20.x
- **npm**: 9.x 或更高版本
- **操作系统**: Windows/macOS/Linux

## 快速启动（3 步）

### 1. 安装依赖

由于 Tiptap 暂不支持 React 19，需要使用 `--legacy-peer-deps` 标志：

```bash
npm install --legacy-peer-deps
```

> **为什么需要这个标志？**  
> @tiptap/react@2.6.6 要求 React 17/18，但项目使用了 React 19。`--legacy-peer-deps` 允许 npm 忽略 peer dependency 版本冲突。

### 2. 配置 API Key

项目支持三种 AI 服务商，选择其中一个配置即可：

#### 方案 A：Gemini（默认，免费额度大）

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...你的Key
```

**获取地址：** https://ai.google.dev/

#### 方案 B：DeepSeek（便宜，国内快）

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...你的Key
DEEPSEEK_MODEL=deepseek-chat
```

**获取地址：** https://platform.deepseek.com/  
**价格：** ¥1/百万tokens（比 Gemini 便宜 10 倍）

#### 方案 C：GLM 智谱（国产，稳定）

```bash
AI_PROVIDER=glm
GLM_API_KEY=xxx.xxx
GLM_MODEL=glm-4-flash
```

**获取地址：** https://open.bigmodel.cn/  
**价格：** ¥0.1/千tokens

**配置步骤：**
1. 打开 `.env.local` 文件
2. 取消注释你选择的服务商配置
3. 填入真实的 API Key
4. 保存后重启开发服务器

### 3. 启动开发服务器

```bash
npm run dev
```

浏览器自动打开 `http://localhost:3000`

---

## 常见问题

### Q1: npm install 报错 ERESOLVE

**解决方案 A（推荐）：** 使用 legacy peer deps
```bash
npm install --legacy-peer-deps
```

**解决方案 B：** 降级 React 到 18.x
```bash
npm install react@18.3.1 react-dom@18.3.1 --save
npm install
```

### Q2: 启动后页面空白

检查浏览器控制台是否有 API Key 错误：
- 确认 `.env.local` 文件存在
- 确认 `GEMINI_API_KEY` 拼写正确
- 重启开发服务器（Ctrl+C 后重新 `npm run dev`）

### Q3: 端口 3000 被占用

修改 `vite.config.ts` 中的端口：
```typescript
server: {
  port: 3001, // 改为其他端口
  host: '0.0.0.0',
}
```

---

## 生产构建

```bash
# 构建
npm run build

# 预览构建结果
npm run preview
```

构建产物在 `dist/` 目录。

---

## 项目结构速览

```
PPTagent/
├── components/          # React 组件
│   ├── ProjectDashboard.tsx   # 项目仪表盘
│   ├── ArticleEditor.tsx      # 文章编辑器
│   ├── ScriptEngine.tsx       # 脚本引擎
│   └── ...
├── services/           # API 服务
│   ├── geminiService.ts       # Gemini AI 集成
│   └── githubService.ts       # GitHub 集成
├── utils/              # 工具函数
├── App.tsx             # 主应用
├── types.ts            # TypeScript 类型定义
└── .env.local          # 环境变量（需手动创建）
```

---

## 开发工作流

1. **选题调研** → Research Panel
2. **撰写文章** → Article Editor (CMS)
3. **生成海报** → Poster Editor
4. **拆解脚本** → Script Engine (A2S)
5. **生成视觉** → Visual Stage
6. **导出视频** → Export Stage

---

## 技术栈

- **前端框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **AI 服务**: Google Gemini API
- **富文本编辑**: Tiptap 2.6.6
- **动画**: Framer Motion

---

## 获取帮助

- 查看 [README.md](../README.md)
- 访问 [AI Studio](https://ai.studio/apps/drive/1WUF49BTwR47PQtnX1flFN72Lj6gzdLDd)
