# 客服工单 Agent 系统文档

## 目录

1. [系统架构](#系统架构)
2. [Agent 能力说明](#agent-能力说明)
3. [用户使用手册](#用户使用手册)
4. [开发者指南](#开发者指南)
5. [部署与运维](#部署与运维)

---

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端应用 (React 19)                      │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│  │   首页       │  工单管理    │  智能客服    │ 管理仪表盘 │ │
│  │  (Home)      │  (Tickets)   │  (Chat)      │(Dashboard) │ │
│  └──────────────┴──────────────┴──────────────┴────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │ tRPC 调用
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  后端 API 层 (Express + tRPC)                │
│  ┌──────────────┬──────────────┬──────────────┬────────────┐ │
│  │  工单路由    │  知识库路由  │  聊天路由    │ 统计路由   │ │
│  │(tickets)     │(knowledge)   │(chat)        │(stats)     │ │
│  └──────────────┴──────────────┴──────────────┴────────────┘ │
└────────────────────────────┬────────────────────────────────┘
                             │
                ┌────────────┼────────────┐
                ▼            ▼            ▼
        ┌─────────────┐ ┌─────────────┐ ┌──────────────┐
        │   数据库    │ │  LLM API    │ │ 向量检索引擎 │
        │  (MySQL)    │ │  (Manus)    │ │ (简单文本搜索)│
        └─────────────┘ └─────────────┘ └──────────────┘
```

### 核心模块

#### 1. **工单管理模块**

- **职责**：工单的全生命周期管理
- **功能**：
  - 创建工单（用户）
  - 查询工单列表（支持筛选、搜索）
  - 查看工单详情
  - 更新工单状态和优先级（管理员）
  - 添加工单备注
  - 获取工单统计数据

#### 2. **知识库模块**

- **职责**：存储和检索客服知识库
- **功能**：
  - 存储 FAQ、产品说明、政策等知识条目
  - 按关键词搜索知识库
  - 支持分类管理（FAQ、政策、技术等）
  - 为 RAG 系统提供数据源

#### 3. **智能客服 Agent 模块**

- **职责**：提供 AI 驱动的客服对话能力
- **功能**：
  - 接收用户问题
  - 从知识库检索相关内容（RAG）
  - 调用 LLM 生成智能回答
  - 保存聊天记录
  - 显示参考知识库条目

#### 4. **认证与权限模块**

- **职责**：用户认证和权限控制
- **功能**：
  - Manus OAuth 集成
  - 用户会话管理
  - 角色区分（普通用户 vs 管理员）
  - 接口级权限控制

### 数据模型

#### Users 表

```sql
- id: 主键
- openId: Manus OAuth 用户标识（唯一）
- name: 用户名
- email: 邮箱
- loginMethod: 登录方式
- role: 角色 (user | admin)
- createdAt: 创建时间
- updatedAt: 更新时间
- lastSignedIn: 最后登录时间
```

#### Tickets 表

```sql
- id: 主键
- userId: 创建用户 ID
- title: 工单标题
- description: 工单描述
- status: 状态 (pending | in_progress | resolved | closed)
- priority: 优先级 (low | medium | high | urgent)
- createdAt: 创建时间
- updatedAt: 更新时间
```

#### KnowledgeBase 表

```sql
- id: 主键
- title: 知识条目标题
- content: 知识条目内容
- category: 分类 (FAQ | 政策 | 技术 | 账户 | 物流 | 促销 | 保修 | 联系方式)
- keywords: 关键词（逗号分隔）
- createdAt: 创建时间
- updatedAt: 更新时间
```

#### ChatMessages 表

```sql
- id: 主键
- userId: 用户 ID
- role: 消息角色 (user | assistant)
- content: 消息内容
- relatedKnowledgeIds: 关联知识库 ID（JSON 数组）
- createdAt: 创建时间
```

#### TicketNotes 表

```sql
- id: 主键
- ticketId: 工单 ID
- userId: 创建用户 ID
- content: 备注内容
- noteType: 备注类型 (comment | status_change | priority_change)
- createdAt: 创建时间
```

### 数据流

#### 工单创建流程

```
用户填写表单
    ↓
前端调用 tickets.create
    ↓
后端验证用户身份
    ↓
创建工单记录
    ↓
返回工单 ID
    ↓
前端跳转到工单详情页
```

#### 智能客服对话流程

```
用户输入问题
    ↓
前端调用 chat.sendMessage
    ↓
后端接收消息
    ↓
从知识库检索相关内容（RAG）
    ↓
调用 LLM API 生成回答
    ↓
保存聊天记录和关联知识库 ID
    ↓
返回 AI 回答和参考知识库
    ↓
前端显示对话和知识库引用
```

---

## Agent 能力说明

### 智能客服 Agent 的核心能力

#### 1. **知识库检索（RAG）**

- **能力**：根据用户问题从知识库中检索相关内容
- **实现方式**：
  - 对用户问题进行关键词提取
  - 在知识库中搜索匹配的条目
  - 返回相关度最高的知识条目
- **限制**：
  - 当前使用简单的文本匹配（LIKE 查询）
  - 可升级为向量相似度检索以提高准确度
  - 最多返回 3 条相关知识条目

#### 2. **智能回答生成**

- **能力**：基于检索到的知识库内容，使用 LLM 生成自然流畅的回答
- **实现方式**：
  - 将用户问题和检索到的知识库内容组织为 prompt
  - 调用 Manus LLM API（支持多种模型）
  - LLM 基于知识库内容生成回答
- **特点**：
  - 回答基于真实知识库数据，避免幻觉
  - 自动标注参考知识库条目
  - 支持 Markdown 格式回答

#### 3. **对话历史管理**

- **能力**：保存和检索用户的聊天历史
- **功能**：
  - 每条消息都被持久化到数据库
  - 支持查询用户的完整对话历史
  - 记录每条消息的关联知识库 ID
- **用途**：
  - 用户可以查看过往对话
  - 支持后续的对话上下文理解（可扩展）

#### 4. **工单关联**

- **能力**：将客服对话与工单系统关联
- **可扩展方向**：
  - 用户可在聊天中直接创建工单
  - 自动将聊天内容作为工单描述
  - 追踪工单的聊天历史

### Agent 的配置与定制

#### 知识库管理

- **添加知识**：通过数据库直接插入或提供管理界面
- **分类管理**：支持 8 种预定义分类
- **关键词优化**：通过关键词字段优化搜索效果

#### LLM 模型选择

- **支持模型**：Claude、GPT、Gemini 等（由 Manus 平台提供）
- **配置方式**：在后端代码中指定模型 ID
- **性能调优**：可调整 temperature、max_tokens 等参数

#### 搜索策略优化

- **当前策略**：本地向量检索优先，关键词匹配兜底
- **实现方式**：
  - 使用本地 `BAAI/bge-m3` embedding 模型生成查询和知识库向量
  - 通过 Docker Compose 启动 `text-embeddings-inference` 服务
  - 将知识库向量存储在 MySQL `knowledge_base.embedding` JSON 字段
  - 在 Node 侧计算余弦相似度并返回相关条目
  - 当本地 embedding 服务不可用或条目未回填向量时，自动回退到关键词 LIKE 搜索

### Agent 的限制与注意事项

1. **知识库覆盖范围**
   - Agent 只能回答知识库中存在的内容
   - 超出范围的问题可能得不到准确回答
   - 建议定期审查和更新知识库

2. **LLM 调用成本**
   - 每条消息都会调用 LLM API
   - 大量并发可能导致成本上升
   - 建议实现缓存机制优化成本

3. **响应延迟**
   - LLM API 调用可能需要 1-5 秒
   - 前端应显示加载状态
   - 可考虑实现流式响应优化用户体验

4. **准确度与幻觉**
   - LLM 可能生成超出知识库的内容
   - 建议在 prompt 中明确指示"仅基于提供的知识库回答"
   - 定期审查 Agent 回答质量

---

## 用户使用手册

### 快速开始

#### 1. 登录

- 首次访问应用时，点击"登录"按钮
- 通过 Manus OAuth 完成身份验证
- 登录成功后进入用户中心

#### 2. 创建工单

- 点击"创建工单"卡片或导航菜单
- 填写以下信息：
  - **工单标题**：简洁描述问题
  - **问题描述**：详细说明问题背景和现象
  - **优先级**：选择 低/中/高/紧急
- 点击"创建工单"按钮提交
- 系统返回工单 ID，可在工单列表中查看

#### 3. 查看工单

- 点击"我的工单"进入工单列表
- **筛选功能**：
  - 按状态筛选（待处理、处理中、已解决、已关闭）
  - 按优先级筛选（低、中、高、紧急）
- **搜索功能**：输入工单标题关键词搜索
- 点击工单卡片查看详细信息

#### 4. 工单详情页

- **工单信息**：显示标题、描述、状态、优先级、创建时间
- **状态流转**：
  - 待处理 → 处理中 → 已解决 → 已关闭
  - 管理员可更新状态
- **优先级调整**：管理员可修改优先级
- **备注记录**：显示所有历史备注和状态变更记录
- **添加备注**：用户可添加新备注跟进工单

#### 5. 智能客服聊天

- 点击"智能客服"进入聊天界面
- 在输入框输入您的问题
- 点击"发送"按钮或按 Enter 键
- AI 助手将：
  - 从知识库检索相关内容
  - 基于知识库生成智能回答
  - 显示参考的知识库条目
- 支持多轮对话，聊天历史自动保存

#### 6. 管理员功能（仅管理员可用）

- 点击"管理员仪表盘"进入管理界面
- **统计卡片**：显示工单总数、各状态数量
- **柱状图**：展示工单状态分布
- **饼图**：显示工单比例关系
- **快速操作**：
  - 查看所有工单
  - 访问智能客服

### 常见问题

**Q: 如何修改已创建的工单？**
A: 进入工单详情页，管理员可以修改状态和优先级。工单标题和描述创建后不可修改。

**Q: 智能客服能回答所有问题吗？**
A: 智能客服基于知识库回答问题。如果您的问题超出知识库范围，可以创建工单由人工客服处理。

**Q: 如何查看聊天历史？**
A: 进入智能客服页面，系统会自动加载您的聊天历史。

**Q: 工单优先级有什么区别？**
A:

- 低：一般问题，响应时间 2-3 天
- 中：标准问题，响应时间 24 小时
- 高：重要问题，响应时间 4-8 小时
- 紧急：影响业务，响应时间 1-2 小时

---

## 开发者指南

### 项目结构

```
customer_service_agent/
├── client/                      # 前端应用
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   │   ├── Home.tsx        # 首页
│   │   │   ├── TicketList.tsx  # 工单列表
│   │   │   ├── TicketDetail.tsx# 工单详情
│   │   │   ├── TicketCreate.tsx# 工单创建
│   │   │   ├── SmartChat.tsx   # 智能客服
│   │   │   └── AdminDashboard.tsx # 管理仪表盘
│   │   ├── components/         # 可复用组件
│   │   ├── lib/               # 工具函数
│   │   └── App.tsx            # 路由配置
│   └── index.html
├── server/                      # 后端应用
│   ├── routers.ts             # tRPC 路由定义
│   ├── db.ts                  # 数据库查询函数
│   ├── storage.ts             # 文件存储
│   └── _core/                 # 核心框架代码
├── drizzle/                     # 数据库 Schema
│   ├── schema.ts              # 表定义
│   └── migrations/            # 迁移文件
├── scripts/                     # 工具脚本
│   └── seed-data.mjs          # 数据初始化
└── package.json
```

### 添加新功能

#### 1. 添加新的数据表

**步骤**：

1. 在 `drizzle/schema.ts` 中定义新表
2. 运行 `pnpm drizzle-kit generate` 生成迁移 SQL
3. 通过 `webdev_execute_sql` 应用迁移
4. 在 `server/db.ts` 中添加查询函数

**示例**：添加"常见问题分类"表

```typescript
export const faqCategories = mysqlTable("faq_categories", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

#### 2. 添加新的 API 接口

**步骤**：

1. 在 `server/routers.ts` 中添加新的 procedure
2. 调用 `server/db.ts` 中的查询函数
3. 返回类型化的结果
4. 前端通过 `trpc.*.useQuery/useMutation` 调用

**示例**：添加获取 FAQ 分类的接口

```typescript
faqCategories: router({
  list: publicProcedure.query(async ({ ctx }) => {
    return await db.query.faqCategories.findMany();
  }),
}),
```

#### 3. 添加新的前端页面

**步骤**：

1. 在 `client/src/pages/` 中创建新组件
2. 使用 `trpc.*.useQuery/useMutation` 调用后端 API
3. 在 `client/src/App.tsx` 中注册路由
4. 在导航菜单中添加链接

**示例**：

```typescript
// 在 App.tsx 中添加路由
<Route path={"/faq-categories"} component={FaqCategories} />

// 在 Home.tsx 中添加导航
<Button onClick={() => setLocation("/faq-categories")}>
  FAQ 分类
</Button>
```

### 扩展 Agent 能力

#### 本地向量检索（RAG）

**当前实现**：本地 `BAAI/bge-m3` 向量检索 + MySQL JSON 向量存储

```typescript
// 1. 查询时生成 query embedding
const queryEmbedding = await createEmbedding(query, "query");

// 2. 从 MySQL 读取知识库条目的 embedding
const entries = await db.select().from(knowledgeBase);

// 3. 在 Node 侧计算余弦相似度
const results = entries
  .map(entry => ({
    entry,
    score: cosineSimilarity(queryEmbedding, parseEmbedding(entry.embedding)),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);
```

**知识库向量回填**：

```bash
# 检查本地 embedding 服务是否可用
npm run kb:embed:check

# 为未生成向量的知识库条目回填 embedding
npm run kb:embed
```

**本地 embedding 服务**：

- 服务由 `compose.yaml` 中的 `embeddings` 容器提供
- 模型：`BAAI/bge-m3`
- API：OpenAI-compatible `/v1/embeddings`
- 默认地址：`http://localhost:8080/v1/embeddings`
- 当前输出维度：1024

**后续可选升级**：

- 数据量增长后，可迁移到专用向量数据库（如 Milvus、Weaviate、Pinecone）
- 可增加 RAG 调试页面展示召回分数和命中文档
- 可增加 embedding 版本字段，便于模型升级后批量重建向量

#### 实现多轮对话上下文

**当前实现**：每条消息独立处理

```typescript
const response = await invokeLLM({
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ],
});
```

**升级方案**：保留对话上下文

```typescript
// 1. 加载对话历史
const history = await db.query.chatMessages.findMany({
  where: eq(chatMessages.userId, userId),
  orderBy: asc(chatMessages.createdAt),
  limit: 10, // 保留最近 10 条消息
});

// 2. 构建完整的消息序列
const messages = [
  { role: "system", content: systemPrompt },
  ...history.map(msg => ({
    role: msg.role,
    content: msg.content,
  })),
  { role: "user", content: userMessage },
];

// 3. 调用 LLM
const response = await invokeLLM({ messages });
```

### 性能优化建议

1. **缓存知识库**
   - 在应用启动时加载知识库到内存
   - 减少数据库查询
   - 定期刷新缓存

2. **异步处理**
   - LLM 调用使用异步队列
   - 避免阻塞主线程
   - 实现超时控制

3. **数据库优化**
   - 为 `keywords` 字段添加索引
   - 为 `status` 和 `priority` 字段添加索引
   - 定期分析查询性能

4. **前端优化**
   - 实现工单列表虚拟滚动
   - 使用 React Query 缓存
   - 实现乐观更新

### 测试

#### 后端单元测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test server/tickets.test.ts

# 监听模式
pnpm test --watch
```

#### 前端测试

```bash
# 使用 Vitest 编写测试
# 示例：client/src/pages/TicketList.test.tsx

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TicketList from "./TicketList";

describe("TicketList", () => {
  it("should render ticket list", () => {
    render(<TicketList />);
    expect(screen.getByText("工单列表")).toBeInTheDocument();
  });
});
```

---

## 部署与运维

### 部署流程

#### 1. 本地开发

```bash
# 安装依赖
pnpm install

# 启动 MySQL 和本地 embedding 服务
docker compose up -d mysql embeddings

# 初始化知识库数据
npm run db:seed

# 检查并回填知识库向量
npm run kb:embed:check
npm run kb:embed

# 启动开发服务器
pnpm dev

# 访问 http://localhost:3000
```

#### 2. 生产构建

```bash
# 构建前端和后端
pnpm build

# 输出目录：dist/
```

#### 3. 部署到 Manus 平台

- 在 Manus 管理界面点击"Publish"按钮
- 系统自动部署到云环境
- 获得公网 URL 访问应用

### 环境配置

#### 必需环境变量

```
DATABASE_URL=mysql://user:password@host:port/database
JWT_SECRET=your-secret-key
VITE_APP_ID=manus-oauth-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
```

#### 可选环境变量

```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-compatible-api-key
OPENAI_BASE_URL=https://api.openai.com
OPENAI_MODEL=gpt-5.5

EMBEDDING_PROVIDER=local
LOCAL_EMBEDDING_BASE_URL=http://localhost:8080
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3
LOCAL_EMBEDDING_PATH=/v1/embeddings
LOCAL_EMBEDDING_API_KEY=  # 本地服务需要鉴权时填写

RAG_EMBEDDINGS_ENABLED=true
KNOWLEDGE_BASE_CACHE_TTL=3600
```

#### 本地 embedding 服务

本地 RAG 使用 Docker Compose 中的 `embeddings` 服务：

```bash
# 启动服务
docker compose up -d embeddings

# 查看服务状态
docker compose ps

# 查看模型服务日志
docker logs customer_service_agent_embeddings

# 验证 embedding 连通性
npm run kb:embed:check
```

首次启动会下载 `BAAI/bge-m3` 模型权重，耗时取决于网络。权重会缓存在 Docker volume `tei_data` 中，后续重启会明显更快。

### 监控与日志

#### 日志位置

```
.manus-logs/
├── devserver.log      # 服务器日志
├── browserConsole.log # 浏览器控制台日志
├── networkRequests.log # 网络请求日志
└── sessionReplay.log  # 会话回放日志
```

#### 关键指标

- **API 响应时间**：应保持在 200-500ms
- **LLM 调用延迟**：通常 1-5 秒
- **数据库查询时间**：应保持在 50-100ms
- **错误率**：应低于 1%

### 故障排查

#### 常见问题

**问题 1：工单创建失败**

- 检查数据库连接
- 验证用户认证状态
- 查看 devserver.log 中的错误信息

**问题 2：智能客服无响应**

- 检查 LLM API 配额
- 验证知识库数据是否存在
- 检查网络连接

**问题 3：登录失败**

- 验证 OAuth 配置
- 检查 JWT_SECRET 是否正确
- 清除浏览器 Cookie 重试

#### 调试技巧

1. 启用详细日志：修改 `server/_core/index.ts` 中的日志级别
2. 使用浏览器开发者工具检查网络请求
3. 查看数据库日志排查 SQL 问题
4. 使用 `console.log` 在关键位置添加调试信息

### 备份与恢复

#### 数据库备份

```bash
# 导出数据库
mysqldump -u user -p database > backup.sql

# 导入数据库
mysql -u user -p database < backup.sql
```

#### 定期维护

- 每周检查数据库性能
- 每月审查知识库内容
- 每季度优化数据库索引
- 定期更新依赖包

### 扩展性规划

#### 短期（1-3 个月）

- [x] 实现本地 `BAAI/bge-m3` 向量检索 RAG
- [ ] 添加多轮对话上下文
- [ ] 实现工单分配给客服
- [ ] 添加工单优先级自动调整

#### 中期（3-6 个月）

- [ ] 实现客服工作队列
- [ ] 添加满意度评分
- [ ] 实现工单自动分类
- [ ] 添加性能分析仪表盘

#### 长期（6-12 个月）

- [ ] 实现多渠道集成（邮件、微信等）
- [ ] 添加工单预测分析
- [ ] 实现智能工单路由
- [ ] 构建完整的 CRM 系统

---

## 附录

### 技术栈

| 层级       | 技术            | 版本  |
| ---------- | --------------- | ----- |
| 前端框架   | React           | 19    |
| 前端样式   | Tailwind CSS    | 4     |
| 前端 UI    | shadcn/ui       | -     |
| 后端框架   | Express         | 4     |
| 后端 RPC   | tRPC            | 11    |
| 数据库 ORM | Drizzle ORM     | 0.44+ |
| 数据库     | MySQL           | 8+    |
| 认证       | Manus OAuth     | -     |
| LLM        | Manus Forge API | -     |

### 参考资源

- [tRPC 文档](https://trpc.io)
- [Drizzle ORM 文档](https://orm.drizzle.team)
- [React 文档](https://react.dev)
- [Tailwind CSS 文档](https://tailwindcss.com)
- [shadcn/ui 文档](https://ui.shadcn.com)

### 联系与支持

- **问题反馈**：通过 GitHub Issues 提交
- **功能建议**：在讨论区分享想法
- **技术支持**：查阅文档或联系开发团队
