# 上线准备与部署配置说明

## 关键环境变量

- `DATABASE_URL`：生产 PostgreSQL + pgvector 连接串。上线前执行 `pnpm db:migrate`。
- `JWT_SECRET`：生产必须使用长随机串，避免沿用示例值。
- `VITE_APP_ID` / `OAUTH_SERVER_URL` / `VITE_OAUTH_PORTAL_URL`：Manus OAuth 配置。
- `LLM_PROVIDER=openai`：使用 OpenAI Responses API。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`：OpenAI 兼容服务配置。
- `CHAT_MODE=rag|agent`：`rag` 为直接 RAG，`agent` 为 OpenAI Agents SDK。
- `EMBEDDING_PROVIDER=local|openai|voyage`：embedding 服务提供方。
- `RAG_EMBEDDINGS_ENABLED=true`：生产建议启用；服务不可用时仍会回退关键词检索。

## 部署步骤

1. 安装依赖并构建：`pnpm install --frozen-lockfile && pnpm build`。
2. 准备数据库：安装 pgvector，设置 `DATABASE_URL`，执行 `pnpm db:migrate`。
3. 配置 OpenAI 兼容模型和 embedding 服务。
4. 回填知识库向量：`pnpm kb:embed`。
5. 启动服务：`NODE_ENV=production pnpm start`。
6. 用管理员账号检查知识库、RAG 调试页、智能客服和 Agent Run 详情页。

## 上线检查

- 本地开发登录 `/api/dev-login` 只在 `NODE_ENV=development` 生效。
- 日志只记录 LLM/embedding provider、model、耗时、token 或维度等元信息，不记录用户原文。
- OpenAI/API key、Authorization、cookie、password 类字段会在日志错误信息中脱敏。
- `AGENT_TRACING_ENABLED=true` 时仍保持 `includeSensitiveData=false`。
- Agent 模式上线前确认 `agent_runs` / `agent_run_steps` 表已迁移成功。
