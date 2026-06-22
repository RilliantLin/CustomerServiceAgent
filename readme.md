# 客服工单 Agent 系统

AI 驱动的客服工单系统，覆盖工单全生命周期管理、基于 RAG/Agent 的智能客服、知识库维护、Agent Run 可观测排查与上线准备。

## 技术栈

- 前端：React 19、Tailwind CSS 4、shadcn/ui、wouter
- 数据与接口：tRPC 11、React Query
- 后端：Express 4、OpenAI Agents SDK
- 数据库：PostgreSQL 16 + pgvector、Drizzle ORM
- 向量服务：本地 bge-m3 / OpenAI / Voyage
- LLM：OpenAI Responses API / Manus Forge 兼容路径
- 认证：Manus OAuth，本地开发支持 dev-login

## 核心能力

- 工单管理：创建、筛选、搜索、详情、状态流转、备注、统计。
- 智能客服：RAG 检索知识库，生成回答并展示引用来源。
- Agent 模式：通过 OpenAI Agents SDK 调用知识库和工单工具，支持 SSE 流式事件。
- 知识库管理：手动维护、Markdown/CSV 文档导入、embedding 回填、冲突检测。
- Agent Run 排查：保存运行记录、步骤、最终回答、错误、结构化结果，支持重试。
- 观测与安全：记录 LLM/embedding 耗时和 token/维度元信息，日志脱敏敏感凭据。

## 本地启动

```bash
pnpm install
docker compose up -d postgres embeddings
pnpm db:migrate
pnpm db:seed
pnpm kb:embed
pnpm dev
```

默认访问地址：

- 应用：http://localhost:3000
- PostgreSQL：localhost:5432
- 本地 embedding 服务：http://localhost:8080

本地开发登录：

- 普通用户：http://localhost:3000/api/dev-login
- 管理员：http://localhost:3000/api/dev-login?role=admin

`/api/dev-login` 仅在 `NODE_ENV=development` 生效，生产环境会返回 404。

## 环境变量

复制 `.env.example` 并按环境配置：

```bash
cp .env.example .env
```

关键配置：

- `DATABASE_URL`：PostgreSQL 连接串。
- `JWT_SECRET`：生产必须使用长随机串。
- `LLM_PROVIDER=openai|manus`：LLM provider。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`：OpenAI 兼容模型配置。
- `CHAT_MODE=rag|agent`：直接 RAG 或 Agent SDK 模式。
- `EMBEDDING_PROVIDER=local|openai|voyage`：embedding provider。
- `RAG_EMBEDDINGS_ENABLED=true|false`：关闭后使用关键词检索兜底。
- `AGENT_TRACING_ENABLED=false`：开启 OpenAI Agents tracing 时仍不包含敏感原始数据。

完整说明见 `.env.example` 和 [上线准备说明](references/deployment-readiness.md)。

## 常用命令

```bash
pnpm dev            # 开发服务
pnpm check          # TypeScript 类型检查
pnpm test           # 运行 Vitest 测试
pnpm build          # 生产构建
pnpm start          # 启动生产构建
pnpm db:generate    # 根据 schema 生成迁移
pnpm db:migrate     # 应用迁移
pnpm db:seed        # 初始化示例数据
pnpm kb:embed       # 回填知识库 embedding
pnpm kb:embed:check # 检查 embedding 服务连通性
```

## 项目结构

```text
client/          前端页面、组件、hooks、tRPC 客户端
server/          后端路由、聊天、Agent、数据库访问、知识库导入
drizzle/         数据库 schema 与迁移文件
scripts/         seed、embedding 回填和诊断脚本
references/      阶段说明和部署准备文档
test-data/       知识库导入测试数据
```

## 测试覆盖

当前测试覆盖：

- OpenAI provider Responses API mock 与错误脱敏
- embedding 请求、解析、cosine similarity
- RAG 关键词召回质量
- `chat.sendMessage` 召回、回复、保存消息
- Agent tool 入参校验、结果摘要、结构化输出兜底
- Agent Run 状态与步骤类型
- 本地开发登录生产限制
- 认证登出、知识库解析、基础工单 smoke flow

运行：

```bash
pnpm check
pnpm test
```

## 部署要点

1. 设置生产环境变量，尤其是 `DATABASE_URL`、`JWT_SECRET`、OAuth 和 OpenAI 配置。
2. 执行 `pnpm db:migrate`，Agent 模式需要 `agent_runs` 与 `agent_run_steps` 表。
3. 执行 `pnpm kb:embed` 回填知识库向量。
4. 使用 `NODE_ENV=production pnpm start` 启动服务。
5. 上线后检查智能客服、知识库、RAG 调试和 Agent Run 详情页。

更完整的上线清单见 [references/deployment-readiness.md](references/deployment-readiness.md)。
