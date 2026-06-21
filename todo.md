# 客服工单 Agent 系统 - 阶段计划

## 阶段 0：本地开发与基础能力
- [x] 使用 Docker 启动本地 PostgreSQL + pgvector 服务
- [x] 修复数据库迁移，确保 `users` 与业务表可完整创建
- [x] 初始化知识库、示例用户、示例工单和备注数据
- [x] 增加本地开发登录入口（普通用户 / 管理员）
- [x] 修复工单列表筛选 Select 空值导致的页面崩溃
- [x] 移除未配置 analytics 时的占位脚本请求
- [x] 跑通基础冒烟测试：首页、工单列表、管理员统计、后端 router 调用

## 阶段 1：接入 OpenAI LLM（先不引入 Agent SDK）
- [x] 增加 OpenAI 环境变量：`LLM_PROVIDER`、`OPENAI_API_KEY`、`OPENAI_MODEL`
- [x] 保留 Manus Forge 配置作为可选 fallback，不直接删除旧实现
- [x] 将 `server/_core/llm.ts` 拆成 provider 分流：`manus` / `openai`
- [x] 使用 OpenAI Responses API 实现 `invokeLLM` 的 OpenAI 路径
- [x] 统一 OpenAI 返回结果为当前 `InvokeResult` 结构，减少上层改动
- [x] 给 LLM 调用增加清晰错误信息：缺少 key、模型错误、限流、网络失败
- [x] 更新 `.env.example` 或文档，说明本地 OpenAI 配置方式
- [ ] 验证智能客服在 OpenAI provider 下可正常回复并保存聊天记录（需要用户授权后向配置的 OpenAI endpoint 发送本地测试问题）

## 阶段 2：pgvector RAG（PostgreSQL 向量检索 + 关键词兜底）
- [x] 增加 OpenAI embedding 环境变量：`OPENAI_EMBEDDING_MODEL`
- [x] 增加代理兼容配置：`OPENAI_EMBEDDING_BASE_URL`、`OPENAI_EMBEDDING_PATH`
- [x] 确认 `knowledge_base.embedding` pgvector 字段可用于存储向量
- [x] 实现 embedding 生成函数，输入知识库标题、内容、分类、关键词
- [x] 增加知识库 embedding 回填脚本，例如 `pnpm run kb:embed`
- [x] 增加 embedding 连通性诊断命令：`npm run kb:embed:check`
- [x] 增加 `RAG_EMBEDDINGS_ENABLED=false` 开关，代理未开通 embedding 时走关键词 RAG
- [x] 优化 seed 脚本，避免重复插入知识库导致重复 embedding
- [x] 将 `searchKnowledge` 从标题 LIKE 升级为：
  - [x] query embedding
  - [x] 使用 pgvector cosine distance 排序
  - [x] 返回 topK 条目
- [x] 保留关键词 LIKE 作为无 embedding 或 OpenAI 不可用时的 fallback
- [ ] 在公司代理下验证 embedding endpoint 与模型是否可用
- [x] 在聊天返回里显示引用知识库条目，便于人工检查答案来源
- [x] 增加 RAG 质量测试用例：密码、退货、物流、保修等常见问题

## 阶段 3：提示词与客服回答质量
- [x] 重写客服 system prompt，要求只基于检索知识回答
- [x] 当知识库召回置信度低时，引导用户创建工单，而不是编造答案
- [x] 增加回答格式规范：简洁结论、步骤、必要提醒、引用来源
- [x] 增加多轮上下文：读取最近 N 条 `chat_messages` 作为对话历史
- [x] 控制上下文长度，避免把过多历史和知识库内容塞进一次请求
- [x] 增加 LLM 调用超时与前端失败提示
- [x] 记录 LLM provider、model、引用知识库 ID，方便后续排查

## 阶段 4：Agent SDK 版本（RAG 稳定后再做）
- [ ] 引入 `@openai/agents`，只在服务端使用
- [ ] 将知识库检索封装为 Agent tool：`searchKnowledge`
- [ ] 将创建工单封装为 Agent tool：`createTicket`
- [ ] 将查询工单封装为 Agent tool：`listTickets` / `getTicketById`
- [ ] 将添加备注封装为 Agent tool：`addTicketNote`
- [ ] 设计客服 Agent 指令：优先回答，必要时创建工单或建议人工处理
- [ ] 增加 guardrail：敏感信息、超出知识库范围、越权工单访问
- [ ] 评估 handoff：普通客服、技术支持、售后/退款等多 Agent 分流
- [ ] 接入 tracing，便于观察 Agent 为什么调用工具或拒答
- [ ] 对比 Agent SDK 版本与阶段 2 简单 RAG 版本的成本、延迟和稳定性

## 阶段 5：前端体验与管理能力
- [ ] 聊天页显示 AI 回复加载状态、失败重试和引用来源
- [ ] 聊天页支持一键“转工单”，把当前对话摘要带入工单描述
- [ ] 工单详情页显示关联聊天记录
- [ ] 管理员增加知识库管理页面：新增、编辑、删除、重新生成 embedding
- [ ] 管理员增加 RAG 调试页面：输入问题，查看召回条目和分数
- [ ] 普通用户访问受保护页面时，开发环境走本地登录，生产环境走 Manus OAuth

## 阶段 6：测试、观测与上线准备
- [ ] 为 OpenAI provider 增加单元测试，mock Responses API 返回
- [ ] 为 embedding / cosine similarity 增加单元测试
- [ ] 为 `chat.sendMessage` 增加集成测试：召回、回复、保存消息
- [ ] 增加基础 e2e 冒烟测试：登录、创建工单、查看列表、智能客服问答
- [ ] 增加日志脱敏，避免记录 API key、session cookie、用户敏感内容
- [ ] 增加成本与延迟观测：每次 LLM/embedding 调用耗时、token 使用量
- [ ] 编写部署配置说明：OpenAI key、模型、数据库迁移、embedding 回填
- [ ] 上线前关闭或限制本地开发登录入口，确保只在 development 生效
