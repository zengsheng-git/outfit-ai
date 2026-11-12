# AI 穿搭预演工具 Demo

一个简易的 AI 穿搭搭配工具 Demo，支持从单品库选择服装、拖拽搭配、AI 生成穿搭效果图。

## 效果预览

![AI 穿搭预演工具效果](docs/images/2026-07-05%20155609.png)

## 功能特性

- **单品库区**：展示服装单品，支持搜索和分类筛选
- **拖拽搭配区**：固定槽位式搭配，支持拖拽和点击添加（外套、上衣、下装、连衣裙、袜类、鞋、包、配饰 8 个槽位）
- **穿搭成果展示区**：展示 AI 生成的穿搭效果图
- **两种出图方式**：「AI 模特图」参考单品图生成真人上身效果；「实拍平铺」直接用上传的原图排版，零偏差
- **AI 图像生成**：对接阿里云百炼 API（wan2.7-image），生成真实穿搭效果图
- **MiniMax 备选出图**：没有百炼账号时可用 MiniMax（H3-Image，最多 16 张参考图）出图，效果同样是真人模特照
- **离线示意图渲染**：两个账号都没有时，后端把选中的单品合成到人台上，产出一张随搭配变化的示意图
- **单品图自动补全**：单品图片缺失时，后端启动会自动按分类与颜色生成矢量插画并补齐
- **单品管理**：支持添加、编辑单品，上传本地图片
- **图片下载**：支持下载生成的穿搭效果图

## 技术栈

### 前端
- Vue 3 + Vite + TypeScript
- Naive UI（组件库）
- Pinia（状态管理）
- Vue Router
- Fetch API
- SCSS

### 后端
- NestJS + TypeScript
- Multer（文件上传）
- 本地 JSON 数据存储
- 阿里云百炼 API（wan2.7-image 图像生成）
- sharp（矢量图栅格化，用于生成单品图与离线示意图）

## 项目结构

```
outfit-ai-studio/
├── frontend/          # Vue 3 前端项目
│   ├── src/
│   │   ├── views/OutfitPreview/    # 主页面
│   │   │   ├── components/        # 子组件
│   │   │   │   ├── ItemLibrary.vue   # 单品库
│   │   │   │   ├── ItemCard.vue      # 单品卡片
│   │   │   │   ├── OutfitCanvas.vue  # 搭配区
│   │   │   │   ├── OutfitSlot.vue    # 搭配槽位
│   │   │   │   ├── ResultPreview.vue # 成果展示
│   │   │   │   ├── TopActions.vue    # 顶部操作
│   │   │   │   ├── AddItemDialog.vue # 添加单品对话框
│   │   │   │   └── EditItemDialog.vue # 编辑单品对话框
│   │   │   └── index.vue
│   │   ├── stores/outfit.ts       # Pinia 状态管理
│   │   ├── api/                   # API 接口
│   │   └── types/outfit.ts        # TypeScript 类型
│   └── package.json
├── backend/           # NestJS 后端项目
│   ├── src/
│   │   ├── items/       # 单品模块
│   │   ├── outfits/     # 搭配模块
│   │   ├── generation/  # AI 生成模块
│   │   │   ├── bailian.provider.ts      # 阿里云百炼出图
│   │   │   ├── minimax.provider.ts      # MiniMax 出图（百炼的替代方案）
│   │   │   ├── reference-board.ts        # 单品平铺参考图（MiniMax 只收一张参考图）
│   │   │   ├── local-render.provider.ts  # 离线示意图渲染（无 API Key 时兜底）
│   │   │   ├── outfit-composition.ts     # 单品到人台的合成逻辑
│   │   │   ├── garment-art.ts            # 服装矢量图形库
│   │   │   └── asset-seeder.ts           # 缺失单品图的自动补全
│   │   ├── upload/      # 文件上传模块
│   │   └── common/      # 公共工具
│   ├── data/            # 本地 JSON 数据
│   └── public/          # 静态资源（含 uploads 目录）
├── docs/              # 文档和截图
└── README.md
```

## 快速开始

### 环境要求
- Node.js 18+
- pnpm 8+

### 1. 安装依赖

```bash
# 前端
cd frontend
pnpm install

# 后端
cd backend
pnpm install
```

### 2. 配置环境变量

后端 `.env` 文件（可从 `.env.example` 复制）：

```env
# 阿里云百炼 API（出图优先级最高）
BAILIAN_API_KEY=sk-your-api-key-here
BAILIAN_WORKSPACE_ID=your-workspace-id
BAILIAN_MODEL=wan2.7-image

# MiniMax API（百炼的替代方案，优先级次之）
MINIMAX_API_KEY=
MINIMAX_BASE_URL=https://api.minimaxi.com
MINIMAX_IMAGE_MODEL=MiniMax-H3-Image
MINIMAX_ASPECT_RATIO=2:3

# Mock 模式开关（设为 true 强制走本地示意图渲染）
AI_IMAGE_USE_MOCK=false
```

> **没有百炼账号怎么办？** 用 MiniMax，或者什么都不配。
>
> **方案一：用 MiniMax（推荐）**
> MiniMax 开放平台的 `MiniMax-H3-Image` 图像模型（或更快的 `MiniMax-H3-Image-Highspeed`，参数相同），
> 支持最多 16 张参考图，每件单品单独传入，试装还原度更高。
> 把密钥填进 `backend/.env` 的 `MINIMAX_API_KEY` 即可。
> 注意国内站用 `https://api.minimaxi.com`，国际站用 `https://api.minimax.io`，两者密钥不通用。
>
> **方案二：什么都不配**
> 后端自动改用**离线示意图渲染**：把选中的单品合成到人台上，输出一张 PNG。
> 换搭配就会换图，完整演示「选品 → 搭配 → 出图」闭环，只是画面是插画风格而非真实模特照。
>
> 出图链路是 **百炼 → MiniMax → 离线示意图** 三级降级，谁可用就用谁，
> 全部不可用时保证还能出图。
>
> `.env` 的位置固定为 `backend/.env`，与启动目录无关。
>
> **换密钥**：改 `backend/.env` 里的 `MINIMAX_API_KEY`，然后**重启后端**。
> 密钥只在启动时读取一次，不重启不会生效。
> 界面上「成果展示」右侧会显示当前出图渠道和密钥指纹（如 `出图渠道：MiniMax · sk-cp-Go…__O8`），
> 换完 key 后对着这个指纹确认一下有没有换成功。

### 3. 启动服务

```bash
# 启动后端（端口 3000）
cd backend
pnpm run start:dev

# 启动前端（端口 5173）
cd frontend
pnpm run dev
```

### 4. 访问应用

打开浏览器访问 http://localhost:5173

## 使用流程

1. **选择单品**：从左侧单品库点击"加入搭配"或拖拽到中间搭配区
2. **搭配组合**：在不同槽位添加外套、上衣、下装、连衣裙、袜类、鞋、包、配饰
3. **生成效果图**：点击"生成效果图"按钮，等待 AI 生成
4. **查看成果**：在右侧成果展示区查看生成的穿搭效果图

### 想让出图更贴近实物？

AI 出图是对参考图的**再创作**，颜色和细节会有偏差。想让结果和上传的商品图完全一致：

- 选 **「实拍平铺」** 模式 —— 不经过 AI，画面里就是你上传的那张原图，零偏差
- 单品的**颜色**要填准，**备注**要写清款式特征（如「白色尖头细高跟，脚踝有绑带」），这些会直接进提示词
- 一次多选几件 —— 只选一双鞋时，模型需要凭空编出其余搭配，参考图的权重会被稀释
- 参考图请用白底商品图；带模特和复杂背景的实拍图，模型会连背景一起参考

## API 接口

### 获取单品列表
```
GET /api/items
Query: keyword, category, season, occasion
```

### 创建单品
```
POST /api/items
Body: { name, category, color, season, occasion, imageUrl, note }
```

### 更新单品
```
PUT /api/items/:id
Body: { name?, category?, color?, season?, occasion?, imageUrl?, note? }
```

### 上传图片
```
POST /api/upload/image
Content-Type: multipart/form-data
Body: file (图片文件)
```

### 生成穿搭图
```
POST /api/generation/outfit
Body: { items: OutfitSelection, prompt?: string }
```
响应 data 中 `isFallback` 表示是否降级为离线示意图，`reason` 说明降级原因。

### 查询出图渠道
```
GET /api/generation/status
```
返回各渠道是否可用、当前实际生效的渠道，以及密钥指纹（不暴露完整密钥）。

## 数据

- **单品数据**：`backend/data/items.json`（35 个预置单品）
- **搭配记录**：`backend/data/outfits.json`
- **生成记录**：`backend/data/generation-tasks.json`
- **上传图片**：`backend/public/uploads/`
- **生成的示意图**：`backend/public/generated/`

## 注意事项

1. **AI 图像生成**：出图按 百炼 → MiniMax → 离线示意图 三级降级，详见上文「没有百炼账号怎么办」
2. **MiniMax 限制**：旧模型 `image-01-live` 的 `subject_reference` 只支持 character 类型（会把服装拼板画成一排人），已弃用；现在默认用 `MiniMax-H3-Image`（`/v1/images/edits` 端点，最多 16 张参考图，每件单品单独传入）。编辑端点始终做提示词增强，无法关闭；同步调用最长可等 600 秒。画幅默认 `2:3` 竖版
2. **单品图自动补全**：`public/uploads` 与 `public/generated` 不纳入版本管理，全新克隆后没有图片。后端启动时会检查 `items.json` 中每件单品的图片是否存在，缺失的按分类和颜色生成一张矢量插画（`seed-<id>.png`）并回写数据，因此首次启动后单品库即可正常显示
3. **图片上传**：支持 jpg/jpeg/png/gif/webp 格式，最大 5MB
4. **浏览器支持**：推荐 Chrome、Edge、Firefox 最新版本

## 开发计划

- [x] Phase 0: 项目脚手架
- [x] Phase 1: 类型定义 + Mock 数据
- [x] Phase 2: 静态页面 + 后端接口
- [x] Phase 3: 交互联调（拖拽 + 搜索）
- [x] Phase 4: AI 生成闭环
- [x] Phase 5: 打磨与兜底
- [x] 添加单品功能
- [x] 编辑单品功能
- [x] 图片上传功能
- [x] 图片下载功能
- [x] 单品图缺失自动补全（矢量插画）
- [x] 无百炼账号时的离线示意图渲染

## License

MIT
