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
  title: "Notification hub — YATTA Examples",
  description:
    "Multi-channel notifications — email, in-app and realtime — with per-user preferences and digest batching.",
};

export default function NotificationHubExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Notification hub" },
        ]}
      />

      <H1 eyebrow="Examples" sub="One notification intent, routed to the channels the user actually wants.">
        Notification hub
      </H1>

      <H2 id="intent">One intent, many channels</H2>

      <P>Call sites should not know whether a notification is email or a socket push. They declare the intent; the hub decides the delivery.</P>

      <CodeBlock
        title="yatta/backend/notify.ts"
        code={`import { createAPI } from "yatta/api";
import { notify } from "../func/notify";
import { withSession } from "../func/middleware";

const route = createAPI("/notifications");

route.use(withSession);

route.post("/", async (ctx) => {
  const user = ctx.state.user as { id: string };
  const body = await ctx.json();

  // Fire and forget — delivery happens on a worker.
  await notify({
    userId: user.id,
    intent: "comment.replied",
    title: "Ada replied to your comment",
    body: "…",
    data: { threadId: body.threadId },
  });

  return Response.json({ ok: true }, { status: 202 });
});

export default route;`}
      />

      <H2 id="preferences">Preferences</H2>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`export const schema = {
  notificationPrefs: {
    userId: col.text().primaryKey(),
    // Channel -> intent -> enabled. Absent means "use the default".
    channels: col.json<Record<string, Record<string, boolean>>>().default({}),
    digestHour: col.integer().default(9),   // local hour for the digest
    paused: col.boolean().default(false),
  },

  notifications: {
    id: col.uuid(),
    userId: col.text().references("users.id", { onDelete: "CASCADE" }),
    intent: col.text(),
    title: col.text(),
    body: col.text(),
    data: col.json<Record<string, unknown>>().default({}),
    readAt: col.date().nullable(),
    createdAt: col.createdAt(),
  },
};`}
      />

      <H2 id="route">Route it</H2>

      <P>A preference override beats the channel default. Anything not mentioned falls through, so a new channel is not silently muted by an old record.</P>

      <CodeBlock
        title="yatta/func/notify.ts"
        code={`import { mail } from "./mail";
import { realtime } from "./realtime";
import { events } from "./events";
import { jobs } from "./jobs";

type Channel = "email" | "inapp" | "realtime";

export interface NotifyInput {
  userId: string;
  intent: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

const DEFAULTS: Record<Channel, boolean> = {
  email: true,
  inapp: true,
  realtime: true,
};

/** Digest intents are batched rather than sent immediately. */
const DIGESTED = new Set(["comment.replied", "mention", "weekly.digest"]);

export async function notify(input: NotifyInput): Promise<void> {
  const prefs = await db.notificationPrefs
    .where((f) => f.userId.isEqualTo(input.userId))
    .first();

  if (prefs?.paused) return;

  const channels: Channel[] = ["inapp", "realtime", "email"];

  for (const channel of channels) {
    const override = prefs?.channels?.[channel]?.[input.intent];
    const enabled = override ?? DEFAULTS[channel];

    if (!enabled) continue;

    if (channel === "email" && DIGESTED.has(input.intent)) {
      // Handled by the nightly digest instead of sending now.
      continue;
    }

    await jobs.enqueue("notify:deliver", { ...input, channel }, {
      priority: channel === "realtime" ? "high" : "normal",
    });
  }
}`}
      />

      <H2 id="deliver">Deliver</H2>

      <CodeBlock
        title="yatta/func/notify.ts"
        code={`export interface NotifyJob extends NotifyInput {
  channel: Channel;
}

jobs.handle("notify:deliver", async (job: NotifyJob, ctx) => {
  const { channel, userId, title, body, intent, data } = job;

  switch (channel) {
    case "inapp": {
      const row = await db.notifications.insert({
        userId, intent, title, body, data: data ?? {},
      });

      // Unread badge, straight to the open tabs.
      realtime.to(\`user:\${userId}\`).send("notification.created", {
        id: row.id, intent, title, body, data,
      });
      break;
    }

    case "realtime":
      realtime.to(\`user:\${userId}\`).send("notification.toast", { title, body });
      break;

    case "email": {
      const user = await db.users.findById(userId);
      if (!user?.email) {
        ctx.log.warn("No email for notification", { userId });
        return;
      }

      await mail.send({
        to: user.email,
        subject: title,
        template: "notification",
        props: { intent, title, body, data },
      });
      break;
  }

  ctx.progress(100, channel);
});`}
      />

      <H2 id="digest">Batch the digest</H2>

      <CodeBlock
        title="yatta/func/cron.ts"
        code={`export const cron = createCron(jobs);

cron.schedule("0 * * * *", async () => {
  const users = await db.users.all();

  for (const user of users) {
    const prefs = await db.notificationPrefs
      .where((f) => f.userId.isEqualTo(user.id))
      .first();

    // Per-user hour, not a global one.
    const localHour = (prefs?.digestHour ?? 9) % 24;
    if (new Date().getHours() !== localHour) continue;

    const unread = await db.notifications
      .where((f) => and(
        f.userId.isEqualTo(user.id),
        f.readAt.isNull(),
      ))
      .all();

    if (unread.length === 0) continue;

    await jobs.enqueue("notify:digest", {
      userId: user.id,
      items: unread.map((n) => ({ title: n.title, body: n.body })),
    });
  }
});

jobs.handle("notify:digest", async ({ userId, items }) => {
  const user = await db.users.findById(userId);
  if (!user?.email) return;

  await mail.send({
    to: user.email,
    subject: \`\${items.length} new notifications\`,
    template: "digest",
    props: { items },
  });

  // Mark read only after the send succeeds, so a failure retries rather than
  // silently dropping the notifications.
  await db.notifications
    .where((f) => f.userId.isEqualTo(userId))
    .update({ readAt: new Date() });
});`}
      />

      <Callout kind="tip">Mark records read <em>after</em> delivery, not before. Doing it first means a mail failure loses the notification permanently.</Callout>

      <DocFooter
        prev={{ href: "/docs/examples/search", title: "Full-text search" }}
        next={{ href: "/docs/examples/cron-scheduler", title: "Cron scheduler" }}
      />
    </article>
  );
}
