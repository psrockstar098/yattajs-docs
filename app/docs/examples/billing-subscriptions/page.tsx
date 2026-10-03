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
  title: "Billing and subscriptions — YATTA Examples",
  description:
    "Plans, proration, idempotent webhooks, dunning, and usage metering that survives a retry.",
};

export default function BillingSubscriptionsExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Billing & subscriptions" },
        ]}
      />

      <H1 eyebrow="Examples" sub="Money code is where correctness matters most: every mutation idempotent, every amount in minor units, every webhook safe to replay.">
        Billing & subscriptions
      </H1>

      <H2 id="money">Money in minor units</H2>

      <P>Never store a float for money. <code>0.1 + 0.2 !== 0.3</code> is not a rounding curiosity when it is a customer&rsquo;s invoice.</P>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`export const schema = {
  plans: {
    id: col.text().primaryKey(),          // "pro"
    name: col.text(),
    // All money is an integer count of minor units: 1999 = $19.99.
    priceMonthly: col.integer().default(0),
    priceYearly: col.integer().default(0),
    includedSeats: col.integer().default(1),
    limits: col.json<Record<string, number>>().default({}),
  },

  subscriptions: {
    id: col.uuid(),
    tenantId: col.text(),
    planId: col.text().references("plans.id"),
    status: col.text(),                   // active | past_due | cancelled | trialing
    // Provider-side id, so a replayed webhook maps to the same row.
    providerId: col.text().unique(),
    currentPeriodEnd: col.date(),
    cancelAtPeriodEnd: col.boolean().default(false),
    createdAt: col.createdAt(),
  },

  invoices: {
    id: col.uuid(),
    tenantId: col.text(),
    subscriptionId: col.text().nullable(),
    // Idempotency key. Unique, so a duplicate insert fails rather than
    // double-charging.
    idempotencyKey: col.text().unique(),
    totalMinor: col.integer(),
    status: col.text(),                   // draft | paid | void | uncollectible
    lines: col.json<InvoiceLine[]>(),
    issuedAt: col.createdAt(),
  },

  usage: {
    id: col.uuid(),
    tenantId: col.text(),
    metric: col.text(),
    quantity: col.integer(),
    at: col.createdAt(),
  },
};

export interface InvoiceLine {
  description: string;
  quantityMinor: number;
  amountMinor: number;
}`}
      />

      <H2 id="proration">Proration</H2>

      <P>An upgrade mid-cycle credits the unused time. Doing it in integer milliseconds and rounding once at the end avoids off-by-one-cent invoices.</P>

      <CodeBlock
        title="yatta/func/billing.ts"
        code={`const MS_PER_DAY = 86_400_000;

/**
 * Credit the unused portion of the current period.
 *
 * Rounded at the very end: rounding each term separately is how a proration
 * ends up a cent away from the truth.
 */
export function prorate(
  oldPriceMinor: number,
  newPriceMinor: number,
  periodStart: Date,
  periodEnd: Date,
  at: Date = new Date(),
): InvoiceLine | null {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0) return null;

  const elapsed = Math.max(0, Math.min(at.getTime(), periodEnd.getTime()) - periodStart.getTime());
  const remainingRatio = (total - elapsed) / total;

  const oldRemaining = Math.round(oldPriceMinor * remainingRatio);
  const newRemaining = Math.round(newPriceMinor * remainingRatio);
  const credit = newRemaining - oldRemaining;

  if (credit === 0) return null;

  return {
    description: credit < 0 ? "Prorated charge" : "Prorated credit",
    quantityMinor: 1,
    amountMinor: credit,
  };
}

/** Days left in the period, for the UI to show "cancel and keep until X". */
export function daysRemaining(periodEnd: Date): number {
  return Math.max(0, Math.ceil((periodEnd.getTime() - Date.now()) / MS_PER_DAY));
}`}
      />

      <H2 id="idempotency">Idempotent mutations</H2>

      <P>A payment provider will retry a webhook you already processed. The unique constraint is what turns that from a double charge into a caught error.</P>

      <CodeBlock
        title="yatta/func/billing.ts"
        code={`export async function chargeOnce(
  tenantId: string,
  key: string,
  lines: InvoiceLine[],
): Promise<{ invoice: unknown; created: boolean }> {
  try {
    const invoice = await db.invoices.insert({
      id: crypto.randomUUID(),
      tenantId,
      idempotencyKey: key,
      totalMinor: lines.reduce((n, l) => n + l.amountMinor, 0),
      status: "draft",
      lines,
    });
    return { invoice, created: true };
  } catch (err) {
    // The unique index fired, so this exact charge already exists.
    const existing = await db.invoices
      .where((f) => f.idempotencyKey.isEqualTo(key))
      .first();

    if (!existing) throw err;
    return { invoice: existing, created: false };
  }
}`}
      />

      <Callout kind="warn">Derive the idempotency key from the provider event id, never from a timestamp or a random value. Two genuinely different charges must produce different keys, and the same event replayed must produce the same one.</Callout>

      <H2 id="webhook">Consume the provider webhook</H2>

      <CodeBlock
        title="yatta/backend/billing.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { verifyPayload } from "../func/webhook-signing";
import { chargeOnce } from "../func/billing";
import { jobs } from "../func/jobs";

const route = createAPI("/billing");

route.post("/webhook", async (ctx) => {
  const body = await ctx.req.text();
  const signature = ctx.header("x-yatta-signature");
  if (!signature) throw new HttpError(401, "Missing signature");

  if (!verifyPayload(process.env.BILLING_SECRET!, body, signature)) {
    throw new HttpError(401, "Bad signature");
  }

  const event = JSON.parse(body);

  // Every provider event carries a unique id. That is the idempotency key.
  const key = \`evt_\${event.id}\`;

  switch (event.type) {
    case "invoice.paid": {
      const invoice = await db.invoices
        .where((f) => f.idempotencyKey.isEqualTo(key))
        .first();

      if (invoice) {
        await db.invoices.where((f) => f.id.isEqualTo(invoice.id))
          .update({ status: "paid" });
      }
      break;
    }

    case "invoice.payment_failed": {
      // Dunning is a job: the retry schedule and the emails are slow.
      await jobs.enqueue("billing:dunning", {
        invoiceKey: key,
        tenantId: event.data.tenantId,
        attempt: 1,
      }, { retry: { attempts: 3 } });
      break;
    }

    case "customer.subscription.updated": {
      const sub = await db.subscriptions
        .where((f) => f.providerId.isEqualTo(event.data.providerId))
        .first();

      if (sub) {
        await db.subscriptions.where((f) => f.id.isEqualTo(sub.id)).update({
          planId: event.data.planId,
          status: event.data.status,
          currentPeriodEnd: new Date(event.data.currentPeriodEnd * 1000),
        });
      }
      break;
    }
  }

  // Acknowledge regardless. A non-2xx makes the provider retry forever.
  return new Response(null, { status: 204 });
});`}
      />

      <H2 id="dunning">Dunning</H2>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`const DUNNING_STEPS: Array<{ afterDays: number; label: string }> = [
  { afterDays: 0,  label: "Payment failed" },
  { afterDays: 3,  label: "Reminder" },
  { afterDays: 7,  label: "Final notice" },
  { afterDays: 14, label: "Service paused" },
];

jobs.handle("billing:dunning", async ({ invoiceKey, tenantId, attempt }, ctx) => {
  const step = DUNNING_STEPS[attempt];
  if (!step) return;   // exhausted

  const tenant = await db.tenants.findById(tenantId);
  const invoice = await db.invoices.where((f) => f.idempotencyKey.isEqualTo(invoiceKey)).first();
  if (!invoice || invoice.status === "paid") return;   // recovered

  await mail.send({
    to: tenant.billingEmail,
    subject: step.label,
    template: "dunning",
    props: { amount: (invoice.totalMinor / 100).toFixed(2), attempt },
  });

  const subscription = await db.subscriptions
    .where((f) => f.tenantId.isEqualTo(tenantId))
    .first();

  // Downgrade rather than delete: their data must survive a lapsed card.
  if (step.label === "Service paused" && subscription) {
    await db.subscriptions.where((f) => f.id.isEqualTo(subscription.id))
      .update({ status: "past_due" });
  }

  // Schedule the next step, or let the job retry policy handle a transient
  // mail failure.
  if (DUNNING_STEPS[attempt + 1]) {
    await jobs.enqueue("billing:dunning", {
      invoiceKey, tenantId, attempt: attempt + 1,
    }, { delay: \`\${step.afterDays}d\` });
  }
});`}
      />

      <H2 id="usage">Meter usage</H2>

      <P>Meter events are append-only and summed at read time, so a duplicate delivery shows up as an obvious double count rather than a silent overcharge.</P>

      <CodeBlock
        title="yatta/func/billing.ts"
        code={`export async function meter(
  tenantId: string,
  metric: string,
  quantity = 1,
  idempotencyKey?: string,
): Promise<void> {
  // De-duplicate at the door when the caller can supply a key.
  if (idempotencyKey) {
    const seen = await db.usage
      .where((f) => f.metric.isEqualTo(\`\${metric}:\${idempotencyKey}\`))
      .first();
    if (seen) return;
  }

  await db.usage.insert({
    id: crypto.randomUUID(),
    tenantId,
    metric: idempotencyKey ? \`\${metric}:\${idempotencyKey}\` : metric,
    quantity,
    at: new Date(),
  });
}

/** Sum a metered metric over a window. */
export async function usageIn(tenantId: string, metric: string, days: number): Promise<number> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = db.run(
    \`SELECT COALESCE(SUM(quantity), 0) AS total
       FROM usage WHERE tenantId = ? AND metric = ? AND at >= ?\`,
    [tenantId, metric, since],
    "get",
  );
  return Number(rows?.total ?? 0);
}`}
      />

      <DocFooter
        prev={{ href: "/docs/examples/analytics", title: "Product analytics" }}
        next={{ href: "/docs/examples/admin-console", title: "Admin console" }}
      />
    </article>
  );
}
