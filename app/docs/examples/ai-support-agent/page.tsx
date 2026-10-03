import type { Metadata } from "next";
import {
  H1,
  H2,
  P,
  Callout,
  Breadcrumb,
  DocFooter,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "AI support agent — YATTA Examples",
  description:
    "A tool-calling support agent with full tracing, token and cost accounting, guardrails and a human handoff.",
};

export default function AiSupportAgentExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "AI support agent" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Tool calls as child spans, cost tracked per conversation, and a hard cap so one runaway agent cannot drain a month of budget.">
        AI support agent
      </H1>

      <H2 id="tools">Tools are the real work</H2>

      <P>The model is usually the cheap part. Define tools narrowly, validate their arguments, and trace each one — an agent with four tools produces a readable trace tree.</P>

      <CodeBlock
        title="yatta/func/agent/tools.ts"
        code={`import { z } from "zod";

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
  run: (args: never, ctx: ToolContext) => Promise<unknown>;
}

export interface ToolContext {
  userId: string;
  conversationId: string;
}

// ── Lookups: read-only, safe to run ────────────────────────────────────────

const findOrder = {
  name: "find_order",
  description: "Look up an order by its reference. Use when the user mentions an order number.",
  schema: z.object({
    reference: z.string().regex(/^ORD-\\d{6}$/, "Expected ORD-123456"),
  }),
  run: async (args: { reference: string }, ctx: ToolContext) => {
    const order = await db.orders
      .where((f) => f.reference.isEqualTo(args.reference))
      .first();

    // Ownership check inside the tool, not in the prompt. A prompt is advice;
    // this is a guarantee.
    if (!order || order.userId !== ctx.userId) return { found: false };

    return {
      found: true,
      status: order.status,
      total: (order.totalMinor / 100).toFixed(2),
      shippedAt: order.shippedAt,
    };
  },
} satisfies ToolDefinition;

const checkPolicy = {
  name: "check_policy",
  description: "Answer a question about the returns policy.",
  schema: z.object({ topic: z.string().max(120) }),
  run: async (args: { topic: string }) => {
    const doc = await searchKnowledge(args.topic);
    return { excerpt: doc?.excerpt ?? null, source: doc?.title ?? null };
  },
} satisfies ToolDefinition;

// ── Mutations: require an explicit confirmation ────────────────────────────

const issueRefund = {
  name: "issue_refund",
  description: "Issue a refund. Only call this after the user explicitly confirms.",
  schema: z.object({
    orderReference: z.string().regex(/^ORD-\\d{6}$/),
    amountMinor: z.number().int().positive().max(500_00),
    reason: z.string().min(5).max(300),
  }),
  run: async (args: { orderReference: string; amountMinor: number; reason: string }, ctx) => {
    // A cap the model cannot argue its way past.
    if (args.amountMinor > 50_000) {
      return { ok: false, error: "Refunds over $500 require a human." };
    }

    const order = await db.orders.where((f) => f.reference.isEqualTo(args.orderReference)).first();
    if (!order || order.userId !== ctx.userId) return { ok: false, error: "Unknown order" };
    if (args.amountMinor > order.totalMinor) {
      return { ok: false, error: "Refund exceeds order total" };
    }

    await db.refunds.insert({
      orderId: order.id,
      amountMinor: args.amountMinor,
      reason: args.reason,
      // Recorded so support can see the agent did this.
      viaAgent: true,
      conversationId: ctx.conversationId,
    });

    return { ok: true, refundId: order.id };
  },
} satisfies ToolDefinition;

export const TOOLS = [findOrder, checkPolicy, issueRefund];`}
      />

      <H2 id="loop">The agent loop, traced</H2>

      <P>Every model call and every tool call becomes its own span, so the trace reads as the conversation actually happened.</P>

      <CodeBlock
        title="yatta/func/agent/run.ts"
        code={`import { observer } from "../observe";

const MAX_TURNS = 8;
const MAX_COST_USD = 0.50;   // per conversation, hard stop

export async function runAgent(
  conversationId: string,
  userId: string,
  question: string,
): Promise<{ reply: string; handoff: boolean; costUsd: number }> {
  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: question },
  ];

  let costUsd = 0;
  let handoff = false;

  // The whole agent run is one span; model and tool calls nest inside it.
  return observer.tracer.withSpan("agent",
    {
      kind: "client",
      ai: { operation: "agent", provider: "anthropic", model: "claude-sonnet-4" },
    },
    async (agentSpan) => {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // ── Model call ──────────────────────────────────────────────────────
      const res = await observer.tracer.withSpan("chat",
        {
          kind: "client",
          ai: { operation: "chat", provider: "anthropic", model: "claude-sonnet-4" },
        },
        async (span) => {
        const started = Date.now();

        const response = await callModel({
          messages,
          tools: TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: toJsonSchema(t.schema),
          })),
        });

        const usage = response.usage;
        const cost = estimateCost(response.model, usage.input_tokens, usage.output_tokens);

        // Tokens and cost live on the span itself. There is no separate usage
        // registry to write to — the span is the record.
        span.ai = {
          ...span.ai,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          costUsd: cost,
          model: response.model,
        };

        span.setAttribute("ai.latency_ms", Date.now() - started);
        span.setAttribute("ai.turn", turn);

        return response;
      });

      costUsd += res.cost_usd;
      agentSpan.addEvent("model.call", { turn, cost: res.cost_usd });

      messages.push({ role: "assistant", content: res.content });

      if (!res.tool_calls?.length) {
        return { reply: res.content, handoff: false, costUsd };
      }

      // ── Tool calls ──────────────────────────────────────────────────────
      for (const call of res.tool_calls) {
        const tool = TOOLS.find((t) => t.name === call.name);

        // A model can hallucinate a tool name.
        if (!tool) {
          messages.push({
            role: "user",
            content: \`Unknown tool "\${call.name}". Available: \${TOOLS.map((t) => t.name).join(", ")}\`,
          });
          continue;
        }

        // Validate before running. A bad argument must not reach the database.
        const parsed = tool.schema.safeParse(call.arguments);
        if (!parsed.success) {
          messages.push({
            role: "user",
            content: \`Invalid arguments: \${parsed.error.issues.map((i) => i.message).join("; ")}\`,
          });
          continue;
        }

        // Each tool call is its own span, so a slow query is visible.
        const result = await observer.tracer.withSpan("tool",
          {
            kind: "client",
            ai: { operation: "tool", provider: "internal", model: tool.name },
          },
        async (toolSpan) => {
          try {
            const out = await tool.run(parsed.data as never, { userId, conversationId });
            toolSpan.ok();
            return JSON.stringify(out ?? { ok: true });
          } catch (err) {
            toolSpan.recordError(err);
            // Hand the error back to the model rather than crashing the run —
            // it can often recover on the next turn.
            return JSON.stringify({ error: "tool failed" });
          }
        });

        messages.push({ role: "user", content: \`\${call.name}: \${result}\` });

        if (costUsd > MAX_COST_USD) {
          handoff = true;
          agentSpan.setAttribute("agent.budget_exceeded", true);
          return {
            reply: "I have asked a human colleague to take over.",
            handoff: true,
            costUsd,
          };
        }
      }
    }

    // Ran out of turns with the model still asking for tools.
    handoff = true;
    agentSpan.addEvent("agent.max_turns");

    return {
      reply: "I still need help with this — passing you to a human.",
      handoff: true,
      costUsd,
    };
  });
});`}
      />

      <Callout kind="warn">A per-conversation cost cap is the only thing standing between a retry-looping tool call and a very expensive surprise. Check it after every model call, not just at the end.</Callout>

      <H2 id="handoff">Human handoff</H2>

      <CodeBlock
        title="yatta/func/agent/handoff.ts"
        code={`export async function handoff(
  conversationId: string,
  userId: string,
  reason: string,
  transcript: Array<{ role: string; content: string }>,
): Promise<void> {
  await db.supportQueue.insert({
    id: conversationId,
    userId,
    reason,
    transcript,
    status: "waiting",
    createdAt: new Date(),
  });

  // The agent stops here. It must not keep talking over a human.
  await realtime.to(\`support:\${conversationId}\`).send("handoff.requested", {
    reason,
  });

  // Page the on-call channel rather than email, so someone sees it now.
  await jobs.enqueue("support:notify", {
    conversationId,
    reason,
    transcriptUrl: \`/admin/conversations/\${conversationId}\`,
  });
}`}
      />

      <H2 id="guardrails">What the prompt must not do</H2>

      <CodeBlock
        title="yatta/func/agent/prompt.ts"
        code={`export const SYSTEM_PROMPT = \`You are a support agent for an online store.

Rules:
- Never state a shipping date unless find_order returned one.
- Never offer a discount. You may explain existing promotions.
- issue_refund requires the customer to have said yes in their own words.
- If find_order returns found: false, say you could not find it. Do not guess.
- If you need something not in your tools, say so and offer a human.
- Amounts are in minor units: 1999 means $19.99.
\`;`}
      />

      <Callout kind="tip">List what the model must not do in the system prompt, and enforce what matters in code. The prompt prevents most mistakes; the ownership checks and amount caps prevent the rest.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/admin-console", title: "Admin console" }}
        next={{ href: "/docs/examples/quota-enforcement", title: "Quota enforcement" }}
      />
    </article>
  );
}
