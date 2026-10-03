import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Mail — YATTA Docs",
  description:
    "Transactional email with layouts, typed templates, pipe filters, plain-text fallbacks, and seven transports.",
};

export default function MailDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Mail" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="Templates with layouts and typed payloads, a plain-text fallback generated from the HTML, and transport headers sanitised against injection. In development it prints to the terminal.">
        Mail
      </H1>

      <H2>Setup</H2>

      <CodeBlock
        title="yatta/func/mail.ts"
        code={`import { createMailer } from "yatta/mail";

export interface AppTemplates {
  welcome: { name: string; verifyUrl: string };
}

declare module "yatta/mail" {
  interface MailRegister {
    templates: AppTemplates;
  }
}

export const mailer = createMailer({
  defaultFrom: "Yatta App <hello@yatta.dev>",
  mode: process.env.NODE_ENV === "production" ? "smtp" : "terminal",
});`}
      />

      <P>
        <Code>terminal</Code> logs the rendered message instead of sending it, so
        local development needs no credentials.
      </P>

      <H2>Layouts</H2>

      <P>
        A layout wraps a template&apos;s body. Use{" "}
        <Code>{"{{{content}}}"}</Code> for the template, and{" "}
        <Code>{"{{name}}"}</Code> for an escaped value.
      </P>

      <CodeBlock
        code={`mailer.registerLayout(
  "default",
  \`<!DOCTYPE html>
  <html>
    <body style="font-family:sans-serif;background:#fafafa;padding:20px;">
      <div style="background:#fff;padding:24px;border-radius:8px;max-width:600px;margin:auto;">
        {{{content}}}
      </div>
    </body>
  </html>\`,
);`}
      />

      <Note>
        <Code>{"{{value}}"}</Code> is HTML-escaped;{" "}
        <Code>{"{{{value}}}"}</Code> is raw. Always use the escaped form for
        anything a user supplied.
      </Note>

      <H2>Templates</H2>

      <CodeBlock
        code={`mailer.registerTemplate<AppTemplates["welcome"]>("welcome", {
  subject: "Welcome to Yatta, {{name}}!",
  layout: "default",
  html: \`
    <h2>Welcome, {{name}}</h2>
    <p>Please confirm your email address:</p>
    <a href="{{{verifyUrl}}}">Verify Email</a>
  \`,
});`}
      />

      <H2>Sending</H2>

      <CodeBlock
        title="send"
        code={`// Using a registered template — data is type-checked
await mailer.send({
  to: "ada@example.com",
  template: "welcome",
  data: { name: "Ada", verifyUrl: "https://app.dev/verify?token=abc" },
});

// Direct, without a template
await mailer.send({
  to: "ada@example.com",
  subject: "Your receipt",
  text: "Thanks for your order.",
  html: "<p>Thanks for your order.</p>",
});

// Preview without sending
const preview = await mailer.preview({
  to: "ada@example.com",
  template: "welcome",
  data: { name: "Ada", verifyUrl: "https://app.dev/verify?token=abc" },
});`}
      />

      <H2>Pipe filters</H2>

      <P>
        Format values inline instead of pre-formatting them in JavaScript.
      </P>

      <CodeBlock
        title="Filters"
        code={`mailer.send({
  to,
  subject: "Invoice {{ amount | currency:USD }}",
  html: \`<p>Total: {{ amount | currency:USD }}</p>\`,
});`}
      />

      <H2>Attachments and CC</H2>

      <CodeBlock
        code={`await mailer.send({
  to: "ada@example.com",
  cc: ["grace@example.com"],
  bcc: ["audit@example.com"],
  replyTo: "support@yatta.dev",
  subject: "Your report",
  html: "<p>Attached.</p>",
  attachments: [
    { filename: "report.pdf", content: buffer },
    { filename: "logo.png", path: "./assets/logo.png" },
  ],
});`}
      />

      <H2>Transports</H2>

      <UL>
        <LI><Code>smtp</Code> — any SMTP relay</LI>
        <LI><Code>resend</Code>, <Code>postmark</Code>, <Code>sendgrid</Code> — provider APIs</LI>
        <LI><Code>ses</Code> — AWS Simple Email Service</LI>
        <LI><Code>gmail</Code> — OAuth transport</LI>
        <LI><Code>ethereal</Code> — test messages with a preview URL</LI>
        <LI><Code>terminal</Code> — print, for development</LI>
        <LI><Code>memory</Code> — capture, for tests</LI>
      </UL>

      <CodeBlock
        title="SMTP"
        code={`export const mailer = createMailer({
  mode: "smtp",
  defaultFrom: "Yatta <noreply@yatta.dev>",
  provider: "postmark",        // host, port and TLS come from the preset
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
});`}
      />

      <P>
        <Code>mode</Code> decides whether a message is actually transmitted
        (<Code>smtp</Code>, <Code>ethereal</Code>) or not (<Code>terminal</Code>,{" "}
        <Code>memory</Code>). <Code>provider</Code> is a preset for host, port
        and TLS. See{" "}
        <a href="/docs/guides/email" className="underline underline-offset-4">
          Send real email
        </a>{" "}
        for a full walkthrough.
      </P>

      <H2>Testing</H2>

      <P>
        In <Code>memory</Code> mode nothing is sent, and you can assert on what
        would have gone out.
      </P>

      <CodeBlock
        title="memory mode"
        code={`const mailer = createMailer({ mode: "memory", defaultFrom: "T <t@test.dev>" });

await mailer.send({ to: "a@test.dev", subject: "Hi", text: "hello" });

expect(mailer.sentCount()).toBe(1);
expect(mailer.lastSent()?.to).toBe("a@test.dev");
expect(mailer.findSent((m) => m.subject === "Hi")).toHaveLength(1);

mailer.clearSent();`}
      />

      <H2>Sending from a job</H2>

      <CodeBlock
        title="yatta/func/workers.ts"
        code={`jobs.handle("send-email", async ({ data }) => {
  await mailer.send({
    to: data.to,
    subject: data.subject,
    text: data.body,
  });
});`}
      />

      <DocFooter
        prev={{ href: "/docs/storage", title: "Storage" }}
        next={{ href: "/docs/realtime", title: "Realtime" }}
      />
    </article>
  );
}
