# Agent SDK Phase 4 Notes

## Handoff Evaluation

The current implementation keeps real multi-agent handoff disabled by default with
`AGENT_HANDOFFS_ENABLED=false`. Runs still evaluate the likely destination and store
the result in `agent_runs.metadata.handoffEvaluation`.

Suggested routing:

| Category / Risk | Recommended target | Reason |
| --- | --- | --- |
| `urgent` risk | `human_support` | Urgent issues need accountable human follow-up. |
| `technical` | `technical_support` | Product errors and usage failures need technical diagnosis. |
| `refund` / `warranty` | `after_sales_refund` | Refund, return, and warranty flows have policy-sensitive handling. |
| other | `general_support` | Normal FAQ, order, account, and logistics questions can stay in the main agent. |

Do not enable real handoffs until prompts, permissions, and UI recovery behavior are tested for each sub-agent.

## Tracing

Tracing is controlled by `AGENT_TRACING_ENABLED`. It is off by default. When enabled,
the Agent SDK receives a stable `traceId` per `agent_run`, a shared group id, and
redacted tracing settings with `traceIncludeSensitiveData=false`.

The local database remains the primary audit trail:

- `agent_runs` stores status, final answer, error, structured output, metrics, tracing ids, and comparison notes.
- `agent_run_steps` stores thinking, tool calls, tool results, final output, and errors.

## Agent SDK vs Simple RAG

| Dimension | Simple RAG | Agent SDK |
| --- | --- | --- |
| Cost | More predictable: one retrieval path and usually one model call. | Less predictable: tool calls and extra turns may increase usage. |
| Latency | Lower and steadier for FAQ-style answers. | Higher variance because tools and planning can add turns. |
| Stability | Smaller behavior surface, easier to test. | More moving pieces, needs stronger guardrails and run recovery. |
| Capability | Good for grounded answers from knowledge base snippets. | Better for multi-step work: query tickets, create tickets, add notes, summarize runs. |
| Observability | Mostly prompt, response, and retrieved knowledge. | Run/Step timeline, structured output, trace ids, tool summaries, retry lineage. |

Default recommendation: keep `CHAT_MODE=rag` for low-risk FAQ traffic, use
`CHAT_MODE=agent` for workflows that need ticket actions, run recovery, or tool timelines.
