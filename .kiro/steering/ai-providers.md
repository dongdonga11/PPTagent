# AI 服务商配置指南

项目已支持三种 AI 服务商，可根据需求灵活切换。

## 服务商对比

| 服务商 | 价格 | 速度 | 国内访问 | 特色功能 |
|--------|------|------|----------|----------|
| **Gemini** | 免费额度大 | 快 | 需代理 | 图片生成、TTS |
| **DeepSeek** | ¥1/百万tokens | 很快 | ✅ 直连 | 性价比高 |
| **GLM (智谱)** | ¥0.1/千tokens | 快 | ✅ 直连 | 国产稳定 |

## 快速切换

### 1. 使用 Gemini（默认）

```bash
# .env.local
AI_PROVIDER=gemini
GEMINI_API_KEY=AIzaSy...你的Key
```

**获取：** https://ai.google.dev/  
**优势：** 免费额度大，支持图片生成和 TTS  
**限制：** 国内需要代理访问

### 2. 使用 DeepSeek（推荐国内用户）

```bash
# .env.local
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...你的Key
DEEPSEEK_MODEL=deepseek-chat
```

**获取：** https://platform.deepseek.com/  
**优势：** 
- 价格便宜（¥1/百万tokens）
- 国内直连，速度快
- 推理能力强

**限制：** 不支持图片生成和 TTS（这些功能会自动降级）

### 3. 使用 GLM 智谱

```bash
# .env.local
AI_PROVIDER=glm
GLM_API_KEY=xxx.xxx
GLM_MODEL=glm-4-flash
```

**获取：** https://open.bigmodel.cn/  
**优势：**
- 国产服务，稳定可靠
- 价格适中
- 中文理解好

**可选模型：**
- `glm-4-flash` - 快速响应（推荐）
- `glm-4-plus` - 更强能力
- `glm-4` - 标准版本

## 功能支持矩阵

| 功能 | Gemini | DeepSeek | GLM |
|------|--------|----------|-----|
| 文本生成 | ✅ | ✅ | ✅ |
| JSON 输出 | ✅ | ✅ | ✅ |
| 图片生成 | ✅ | ❌ | ❌ |
| 语音合成 (TTS) | ✅ | ❌ | ❌ |
| 选题调研 | ✅ | ✅ | ✅ |
| 文章生成 | ✅ | ✅ | ✅ |
| 脚本拆解 | ✅ | ✅ | ✅ |
| HTML 生成 | ✅ | ✅ | ✅ |

## 注意事项

1. **图片生成**：仅 Gemini 支持，其他服务商会跳过此功能
2. **TTS 语音**：仅 Gemini 支持，其他服务商会静默失败
3. **切换服务商**：修改 `.env.local` 后需重启开发服务器
4. **API Key 安全**：不要将 `.env.local` 提交到 Git

## 成本估算

以生成一篇 2000 字文章 + 10 个分镜为例：

- **Gemini**: 免费（每天 1500 次请求）
- **DeepSeek**: 约 ¥0.01（1 万 tokens）
- **GLM**: 约 ¥0.5（5 千 tokens）

## 故障排查

### 问题：切换服务商后报错

**解决：**
1. 确认 `.env.local` 中对应的 API Key 已填写
2. 重启开发服务器（Ctrl+C 后重新 `npm run dev`）
3. 清除浏览器缓存并刷新

### 问题：DeepSeek/GLM 返回空结果

**解决：**
1. 检查 API Key 是否正确
2. 确认账户余额充足
3. 查看浏览器控制台的错误信息

### 问题：Gemini 连接超时

**解决：**
1. 确认网络可以访问 Google 服务
2. 尝试切换到 DeepSeek 或 GLM
3. 检查代理设置
