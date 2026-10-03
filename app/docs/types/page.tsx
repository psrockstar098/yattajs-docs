import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Typed keys — YATTA Docs",
  description:
    "Teach Yatta your job, event, template and disk names through declaration merging, and get type-safe payloads everywhere with no code generation.",
};

export default function TypesDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Extending" },
          { label: "Typed keys" },
        ]}
      />
      <H1 eyebrow={'Extending'} sub="Every engine accepts free-form names by default. Declare yours once and the whole framework checks them — jobs, events, templates, disks and database rows.">
        Typed keys
      </H1>

      <P>
        TypeScript declaration merging lets you add your own keys to the
        interfaces Yatta declares. This is the same mechanism{" "}
        <Code>bun-types</Code> uses; nothing is generated, so there is no build
        step and nothing to drift out of date.
      </P>

      <H2>Jobs</H2>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs, SQLiteJobStore } from "yatta/jobs";

export interface AppJobs {
  "send-email": { to: string; subject: string; body: string };
  "transcode-video": { videoId: string; quality: "720p" | "1080p" };
  "cleanup-stale-tokens": { maxAgeDays?: number };
}

declare module "yatta/jobs" {
  interface JobRegister extends AppJobs {}
}

export const jobs = createJobs({
  store: new SQLiteJobStore("Database/jobs.db"),
});`}
      />

      <P>Every call site is now checked:</P>

      <CodeBlock
        title="checked"
        code={`await jobs.enqueue("send-email", {
  to: "ada@example.com",
  subject: "Hi",
  body: "Hello",
});          // ✓

await jobs.enqueue("send-email", { to: "ada@example.com" });
          // ✗ Property 'subject' is missing

await jobs.enqueue("emial-send", {});   // ✗ not a known job`}
      />

      <H2>Events</H2>

      <CodeBlock
        title="yatta/func/events.ts"
        code={`export interface AppEvents {
  "user.registered": { userId: string; email: string };
  "order.completed": { orderId: string; amount: number };
}

declare module "yatta/jobs" {
  interface EventRegister extends AppEvents {}
}`}
      />

      <CodeBlock
        code={`events.on("user.registered", (data) => {
  data.email;      // string — typed
});

await events.emit("order.completed", { orderId: "o_1", amount: 42 });`}
      />

      <H2>Mail templates</H2>

      <CodeBlock
        title="yatta/func/mail.ts"
        code={`export interface AppTemplates {
  welcome: { name: string; verifyUrl: string };
  receipt: { total: number; currency: string };
}

declare module "yatta/mail" {
  interface MailRegister {
    templates: AppTemplates;
  }
}`}
      />

      <CodeBlock
        code={`await mailer.send({
  to,
  template: "welcome",
  data: { name: "Ada", verifyUrl: "https://…" },   // ✓
});

await mailer.send({
  to,
  template: "welcome",
  data: { name: "Ada" },                           // ✗ verifyUrl missing
});`}
      />

      <H2>Storage disks</H2>

      <CodeBlock
        title="yatta/func/storage.ts"
        code={`declare module "yatta/storage" {
  interface StorageRegister {
    disks: "local" | "s3" | "backups";
  }
}`}
      />

      <CodeBlock
        code={`await storage.disk("local").upload("a.png", buffer);
await storage.disk("s3").upload("a.png", buffer);
await storage.disk("gcs").upload("a.png", buffer);   // ✗ unknown disk`}
      />

      <H2>Database rows</H2>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`export const schema = {
  users: {
    id: col.uuid(),
    email: col.text().unique(),
    roles: col.json<string[]>().default(["user"]),
    createdAt: col.createdAt(),
  },
};

declare module "yatta/db" {
  interface Register {
    schema: typeof schema;
  }
}`}
      />

      <CodeBlock
        title="typed rows"
        code={`const user = await db.users.findById("u_1");

user.email;     // string
user.roles;     // string[]
user.nope;      // ✗ not a column`}
      />

      <H2>Realtime events</H2>

      <CodeBlock
        code={`declare module "yatta/realtime" {
  interface RealtimeRegister {
    events: {
      "chat.message": { user: string; text: string };
      "order.status": { orderId: string; status: string };
    };
  }
}`}
      />

      <H2>Keeping types tidy</H2>

      <UL>
        <LI>
          Put each augmentation in the file that owns the engine — that keeps the
          declaration next to the code that uses it.
        </LI>
        <LI>
          Use a named interface per app and <Code>extends</Code> it, rather than
          merging straight into <Code>JobRegister</Code>.
        </LI>
        <LI>
          Everything lives in <Code>yatta/func/</Code>, so the shape of your
          system is readable from one folder.
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs/api", title: "HTTP API" }}
        next={{ href: "/docs/config", title: "Configuration" }}
      />
    </article>
  );
}
