# 客服工单 Agent 系统文档

AI 驱动的客服工单系统：工单全生命周期管理 + 基于 RAG 的智能客服 + 可维护的知识库。

## 目录

1. [系统架构](#系统架构)
2. [核心模块](#核心模块)
3. [智能客服 Agent](#智能客服-agent)
4. [知识库管理](#知识库管理)
5. [用户使用手册](#用户使用手册)
6. [开发者指南](#开发者指南)
7. [部署与运维](#部署与运维)
8. [附录](#附录)

---

## 系统架构

```
前端 (React 19 + Tailwind + shadcn/ui)
   │  tRPC（端到端类型安全）
后端 (Express + tRPC)
   │
   ├── PostgreSQL + pgvector   数据 & 向量存储
   ├── Embedding 服务          本地 bge-m3 / OpenAI / Voyage
   └── LLM API                 OpenAI 兼容 / Manus Forge
```

- **前端**：页面分为首页、工单管理、智能客服、知识库、管理仪表盘；路由用 wouter，数据用 tRPC + React Query。
- **后端**：tRPC 路由按域划分（`tickets` / `knowledge` / `chat` / `auth` / `system`），数据库访问集中在 `server/db.ts`。
- **认证**：Manus OAuth，区分普通用户与管理员，接口级权限校验。

---

## 核心模块

| 模块 | 职责 |
| --- | --- |
| 工单管理 | 创建、筛选/搜索、详情、状态与优先级流转、备注、统计 |
| 知识库 | 知识条目的存储、检索、文档批量导入、冲突检测、增删 |
| 智能客服 Agent | RAG 检索 + LLM 生成回答，保存对话并标注引用来源 |
| 认证与权限 | OAuth 登录、会话管理、角色与接口权限 |

### 数据模型（概览）

- **users**：用户与角色（user / admin）。
- **tickets**：工单，含状态（pending / in_progress / resolved / closed）与优先级（low / medium / high / urgent）。
- **ticket_notes**：工单备注与状态变更记录。
- **knowledge_base**：知识条目，含向量 `embedding`、来源文档 `documentId`、嵌入状态、冲突标记（`conflictWith` / `conflictScore`）。
- **knowledge_documents**：上传文档，记录解析状态、索引进度（`totalChunks`）等。
- **chat_messages**：对话记录，保存引用的知识库条目快照。

表结构以 `drizzle/schema.ts` 为准；变更通过 `pnpm db:generate` + `pnpm db:migrate` 管理。

---

## 智能客服 Agent

对话流程：用户提问 → RAG 检索相关知识 → 组织 prompt 调用 LLM → 返回回答并标注引用条目 → 持久化对话。

**检索策略（RAG）**

- 默认本地 `BAAI/bge-m3` 生成查询向量，PostgreSQL pgvector 按余弦距离 + HNSW 索引召回。
- 嵌入服务不可用或条目未生成向量时，自动回退到关键词检索，保证可用性。
- 默认返回相关度最高的若干条，作为回答依据并展示给用户。

**能力与边界**

- 回答基于知识库内容，降低幻觉；超出知识库范围的问题建议转人工/创建工单。
- 每条消息触发一次 LLM 调用，注意成本与延迟；知识库需定期审查更新。

---

## 知识库管理

支持单条手动维护，也支持文档批量导入（管理员，路径 `/admin/knowledge`）。

**文档导入**

- 支持 **Markdown**（按 `#` / `##` 标题切分为多条）与 **CSV**（表头 `title,content,category,keywords`）。
- 文件以文本经 tRPC 上传，后台异步解析、入库并逐条构建向量。
- 页面展示**解析状态**与**索引进度**（前端轮询），完成后停止刷新。

**冲突检测**

- 每条新条目嵌入后，与已有条目比对：向量余弦相似度 ≥ 0.88，或归一化标题相同，即标记为「可能冲突」。
- 冲突条目在列表中**置顶**并显示相似度及最相似条目，由管理员人工取舍。

**增删**

- 可删除单条条目，或删除整份文档（级联删除其生成的全部条目）。
- 列表排序：冲突置顶，其余按更新时间从近到远。

---

## 用户使用手册

- **登录**：通过 Manus OAuth 完成身份验证。
- **创建工单**：填写标题、描述、优先级后提交，系统返回工单 ID。
- **查看工单**：支持按状态/优先级筛选与标题搜索；详情页查看信息、流转状态、添加备注。
- **智能客服**：在聊天页提问，AI 基于知识库回答并展示引用来源，多轮对话自动保存。
- **管理员**：仪表盘查看工单统计与分布；知识库页维护条目与导入文档。

**优先级与建议响应时间**：低 2–3 天 / 中 24 小时 / 高 4–8 小时 / 紧急 1–2 小时。

---

## 开发者指南

### 项目结构

```
client/          前端（pages 页面、components 组件、lib 工具）
server/          后端（routers.ts 路由、db.ts 数据访问、knowledge/ 文档解析与导入、_core/ 框架）
drizzle/         schema.ts 表定义 + 迁移文件
scripts/         seed-data、embed-knowledge 等工具脚本
compose.yaml     postgres + embeddings 本地服务
```

### 常用命令

```bash
pnpm dev            # 开发（前后端一体，默认 http://localhost:3000）
pnpm check          # TypeScript 类型检查
pnpm test           # 运行测试（vitest）
pnpm build          # 生产构建
pnpm db:generate    # 由 schema 生成迁移
pnpm db:migrate     # 应用迁移
pnpm db:seed        # 灌入示例数据
pnpm kb:embed       # 为未生成向量的条目回填 embedding
pnpm kb:embed:check # 检查 embedding 服务连通性
```

### 扩展约定

- **加表**：改 `drizzle/schema.ts` → `db:generate` → `db:migrate` → 在 `db.ts` 加查询函数。
- **加接口**：在 `server/routers.ts` 加 procedure（管理员能力需校验 `ctx.user.role`），调用 `db.ts` 函数。
- **加页面**：在 `client/src/pages/` 建组件，用 `trpc.*.useQuery/useMutation` 取数，在 `App.tsx` 注册路由。

---

## 部署与运维

### 本地启动

```bash
pnpm install
docker compose up -d postgres embeddings   # 启动数据库与本地 embedding 服务
pnpm db:migrate && pnpm db:seed            # 建表 + 示例数据
pnpm kb:embed                              # 回填知识库向量
pnpm dev
```

> 端口：应用 3000、PostgreSQL 5432、embeddings 8080。embeddings 镜像仅有 amd64 版本，Apple 芯片需在 `compose.yaml` 中以 `platform: linux/amd64` 经 Rosetta 运行；首次会下载 bge-m3 权重并缓存到 `tei_data` 卷。

### 环境变量（要点）

```
# 数据库 & 认证
DATABASE_URL=postgres://user:password@host:5432/customer_service_agent
JWT_SECRET=...                # 长随机串
VITE_APP_ID / OAUTH_SERVER_URL / VITE_OAUTH_PORTAL_URL

# LLM（openai 兼容 或 manus）
LLM_PROVIDER=openai
OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL

# Embedding（local / openai / voyage）
EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_BASE_URL=http://localhost:8080
RAG_EMBEDDINGS_ENABLED=true   # 设为 false 时仅用关键词检索
```

完整项可参考 `.env.example`。

### 排查与维护

- 服务问题先看后端日志与 `.manus-logs/`；嵌入相关用 `pnpm kb:embed:check` 和 `docker logs customer_service_agent_embeddings`。
- 登录异常检查 OAuth 配置与 `JWT_SECRET`，必要时清 Cookie。
- 备份：`pg_dump "$DATABASE_URL" > backup.sql`；恢复：`psql "$DATABASE_URL" < backup.sql`。

---

## 附录

### 技术栈

| 层级 | 技术 |
| --- | --- |
| 前端 | React 19、Tailwind CSS 4、shadcn/ui、wouter |
| 数据/状态 | tRPC 11、React Query |
| 后端 | Express 4、tRPC 11 |
| 数据库 | PostgreSQL 16 + pgvector、Drizzle ORM |
| 向量 | bge-m3（本地）/ OpenAI / Voyage |
| LLM | OpenAI 兼容 / Manus Forge |
| 认证 | Manus OAuth |

### 参考

- [tRPC](https://trpc.io) · [Drizzle ORM](https://orm.drizzle.team) · [React](https://react.dev) · [Tailwind CSS](https://tailwindcss.com) · [shadcn/ui](https://ui.shadcn.com) · [pgvector](https://github.com/pgvector/pgvector)
