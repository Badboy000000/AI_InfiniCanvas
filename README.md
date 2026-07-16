# AI 无限画布自由创作平台

面向创作生产场景的可视化 AI 工作流编排系统。

**核心原则**：画布负责可视化编排，后端负责工作流真相与真实执行，节点协议负责能力扩展，能力路由负责多模型稳定性。

正式设计与开发规约维护在 Obsidian 知识库：`E:\个人知识库\AI无限画布自由创作平台`。仓库内保留：

- `CLAUDE.md`：Agent 启动协议
- 本 `README.md`：本地工程速查

**任何非平凡改动前**，Agent 必须先读 Obsidian 中的 [[Agent 阅读指南]] 与 [[工程化落地技术开发要求]]。

---

## 仓库结构

```txt
apps/
  web/                 React + Vite 前端（画布 UI）
  api/                 HTTP + SSE 服务（Workflow CRUD / Run / NodeDefinition）
  worker/              节点运行时 + 能力路由 + mock provider

packages/
  node-protocol/       NodeDefinition 类型与 Zod schema
  workflow-core/       工作流校验（tryValidateEdge / tryValidateWorkflow）+ ExecutionPlan 编译
  canvas-engine/       画布视口与端口坐标核心逻辑
  event-core/          RunEvent / RunState 状态机与事件归约
  capability-core/     CapabilityRouter + ProviderAdapter 协议
  node-definitions/    第一版 MVP 内置节点定义（9 类）
  persistence/         数据仓储抽象 + 内存实现 + Prisma / BullMQ 骨架

scripts/               跨 workspace 测试、冒烟与工具脚本
```

## 快速开始

```bash
bun install
bun run typecheck
bun run build
```

### 一键跑 MVP 后端（API + Worker 一体化）

```bash
bun run dev:mvp     # 起在 http://localhost:4000，预置工作流 wf-mvp
```

### 前端联调

```bash
bun run dev         # Vite 开发服（默认 5173），/api 已代理到 4000
```

打开前端后点击右上角"运行工作流"，画布会通过 API 保存工作流 → 创建 Run → 订阅 SSE → 实时更新节点状态。

### 端到端冒烟

```bash
bun run test:mvp    # 起 API 起 Worker，跑 7 节点电商详情图工作流，断言 success
```

---

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `bun run typecheck` | 全部 workspace TypeScript 检查 |
| `bun run build` | 依赖顺序构建全部 workspace |
| `bun run dev` | 前端 Vite |
| `bun run dev:mvp` | 一体化后端（API + Worker）+ 预置示例 |
| `bun run test:mvp` | 端到端冒烟（HTTP + SSE） |
| `bun run test:api` / `test:worker` | 各自单元 + 集成冒烟 |
| `bun run test:workflow-core` / `test:event-core` / … | 核心包单元测试 |
| `bun run cleanup:temp` | 清理 `.tsbuildinfo` / 临时产物 |

---

## 硬性约束

- **Bun 是唯一包管理器**：使用 `bun install` / `bun add` / `bun run`；不新增 `package-lock.json`
- **核心 packages 不依赖具体运行时框架**：`node-protocol` / `workflow-core` / `canvas-engine` / `event-core` / `capability-core` / `node-definitions` / `persistence` 不依赖 React / NestJS / Prisma / BullMQ / 具体模型 SDK
- **apps 之间不互相依赖**：`apps/api` 不 import `apps/worker`（反之亦然）；跨应用接口通过合同结构 + 结构 typing 保证
- **业务规则先进 packages，apps 只做适配**：连线校验、成环判定、拓扑排序、状态归约、能力路由等只在 packages 里实现
- **拒绝连线必须结构化**：`workflow-core.tryValidateEdge / tryValidateWorkflow` 返回 `WorkflowEdgeRejection[]`，API 遇到就 HTTP 422 原样返回；前端消费 `code` 映射本地文案，不允许拼字符串
- **测试或验证产物必须清理**：见 `scripts/cleanup-temp-files.ts`
- **上游接口变动必须广播**：改核心 package 或合同前，先在开发记录 / [[并行开发协作规约]] 中标注，见 Obsidian 知识库

---

## 第一版明确的降级项（未来升级路径）

| 位置 | 当前 | 升级路径 |
| --- | --- | --- |
| `apps/api/src/http-router.ts` | `node:http` + 手写路由 | 替换为 NestJS Controller（外部 HTTP / SSE 契约不变） |
| `apps/api` `InMemory*` 仓储 | 单进程内存 | 切到 `@ai-canvas/persistence` 的 Prisma 实现（`prisma migrate dev` 建库） |
| `apps/worker` `dispatch` | 同进程直接 await | 切到 `BullMqRunDispatcher`（Redis Streams / BullMQ Queue） |
| `apps/worker/src/providers/mock.ts` | 固定 mock 输出 | 增加 OpenAI / fal / replicate ProviderAdapter，按 [[能力路由第一版策略]] 注册路由 |
| `apps/web` SSE 客户端 | 无断线重连 | 分布式派发后补 Last-Event-Id 重放 |
| 资产存储 | 内存 assetId 字符串 | 引入 MinIO metadata + Prisma `Asset` 表 |
| 图层分离节点 | 未实现 | 依 [[核心数据模型设计]] `LayeredImageResult`，接入 `layer.extract` provider |
| 多屏并行生图 | MVP 只 1 屏 | 按 [[电商详情图工作流示例 JSON]] 补 `orderedInputs` 拼接节点 |
| 鉴权 | 无 | 部署阶段引入 JWT / Session |

---

## 相关文档（Obsidian 知识库）

- 系统架构设计
- 核心数据模型设计
- 节点协议设计
- 能力路由第一版策略
- 技术选型设计
- 工程化落地开发计划 / 工程化落地技术开发要求 / 工程化落地进度台账
- 并行开发协作规约
- API 与 Worker 内部合同
- 开发记录索引（`开发记录/*.md`）
