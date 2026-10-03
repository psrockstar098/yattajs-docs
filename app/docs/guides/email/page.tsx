import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1,
  H2,
  P,
  UL,
  LI,
  Note,
  DocFooter,
  Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Send real email — YATTA Docs",
  description:
    "Step by step: go from terminal output to real, verified email with Resend or SMTP, including the environment variables and mistakes that stop delivery.",
};


export default function EmailGuidePage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Send real email" },
        ]}
      />
      <H1 eyebrow={'Guides'} sub="Out of the box Yatta prints email to the terminal instead of sending it. This guide walks through connecting a real provider, and the four things that usually stop delivery.">
        Send real email
      </H1>

      <H2 id="start-here">Start here</H2>

      <P>
        The mailer reads its transport from <Code>NODE_ENV</Code>. That single
        line is why your email is not arriving — the scaffold sets{" "}
        <Code>{"mode: \"terminal\""}</Code> when <Code>NODE_ENV</Code> is anything
        other than <Code>production</Code>.
      </P>

      <CodeBlock
        title="yatta/func/mail.ts"
        code={`export const mailer = createMailer({
  defaultFrom: "Yatta App <hello@yatta.dev>",
  mode: process.env.NODE_ENV === "production" ? "smtp" : "terminal",
});`}
      />

      <P>
        Pick one of the options below and change that line. Every real provider
        goes through <Code>{"mode: \"smtp\""}</Code> — the difference is the{" "}
        <Code>provider</Code> preset, which supplies the right host, port and TLS
        setting.
      </P>

      <H2 id="why-nothing-arrives">Why nothing arrives yet</H2>

      <P>Four causes, in the order they usually bite:</P>

      <UL>
        <LI>
          <strong className="text-[#f3eed7]/70">Mode is still{" "}
          <Code>terminal</Code>.</strong> The message is printed to the server
          console and never transmitted.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">No credentials.</strong> The
          provider defaults to empty strings and the send fails.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Unverified From domain.</strong>{" "}
          Every major provider rejects mail claiming a domain you have not
          proved you own.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">The mail lands in spam.</strong>{" "}
          SPF, DKIM and DMARC are missing.
        </LI>
      </UL>

      <H2 id="option-a-resend">Option A — Resend</H2>

      <P>
        The shortest path if you have no mail provider yet. Resend requires only
        a domain and an API key, and its SMTP endpoint expects the API key as
        the username.
      </P>

      <CodeBlock
        title="1. Environment"
        lang="bash"
        code={`SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxxxxxxxxxxx
MAIL_FROM="Yatta App <hello@yourdomain.com>"`}
      />

      <CodeBlock
        title="2. Configure the mailer"
        code={`export const mailer = createMailer({
  defaultFrom: process.env.MAIL_FROM || "Yatta <hello@localhost>",
  mode: process.env.NODE_ENV === "production" ? "smtp" : "terminal",
  provider: "resend",        // host, port and TLS are filled in for you
  host: process.env.SMTP_HOST || "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
});`}
      />

      <CodeBlock
        title="3. Add your domain"
        lang="text"
        code={`Resend dashboard → Domains → Add Domain
  → add the DNS records they give you
  → wait for the green check

Until it verifies, Resend will only send TO your own address.`}
      />

      <H2 id="option-b-smtp">Option B — any SMTP relay</H2>

      <P>
        Works with Postmark, SendGrid, Mailgun, SES or your own relay. Use the{" "}
        <Code>provider</Code> preset and only override host and port if your
        relay differs.
      </P>

      <CodeBlock
        title="Environment"
        lang="bash"
        code={`SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=xxxx
MAIL_FROM="Yatta <noreply@yourdomain.com>"`}
      />

      <CodeBlock
        title="Configure"
        code={`export const mailer = createMailer({
  defaultFrom: process.env.MAIL_FROM!,
  mode: process.env.NODE_ENV === "production" ? "smtp" : "terminal",
  provider: "postmark",      // → smtp.postmarkapp.com:587, secure:false
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT ?? 587),
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
  retries: 3,                // transient failures are retried
});`}
      />

      <P>Available presets and their defaults:</P>

      <CodeBlock
        title="presets"
        lang="text"
        code={`gmail    → smtp.gmail.com:465          secure
resend    → smtp.resend.com:465          secure
ses       → email-smtp.us-east-1.amazonaws.com:465   secure
postmark  → smtp.postmarkapp.com:587     STARTTLS
sendgrid  → smtp.sendgrid.net:587        STARTTLS
mailgun   → smtp.mailgun.org:587         STARTTLS
brevo     → smtp-relay.brevo.com:587     STARTTLS`}
      />

      <Note>
        Port 465 uses implicit TLS (<Code>secure: true</Code>). Port 587 uses
        STARTTLS, which the transport negotiates when <Code>secure</Code> is
        false.
      </Note>

      <H2 id="option-c-gmail">Option C — Gmail</H2>

      <P>
        Fine for a side project, not for production. Google caps sending at
        roughly 500 messages a day and flags the mail as suspicious. It also
        requires an app password rather than your account password.
      </P>

      <CodeBlock
        code={`export const mailer = createMailer({
  defaultFrom: "Yatta <you@gmail.com>",
  mode: "smtp",
  provider: "gmail",
  port: 465,
  secure: true,
  auth: {
    user: "you@gmail.com",
    pass: process.env.GMAIL_APP_PASSWORD!,   // not your account password
  },
});`}
      />

      <H2 id="the-from-address">The From address</H2>

      <P>
        This is the single most common cause of silent rejection. Whatever you
        put in <Code>defaultFrom</Code> must belong to a domain you have
        verified with your provider.
      </P>

      <Note kind="warn">
        A <Code>noreply@localhost</Code> sender will be rejected or silently
        dropped by every provider. Use a real domain you control.
      </Note>

      <H2 id="testing-without-users">Testing without users</H2>

      <P>
        Do not test against your colleagues. Use the <Code>ethereal</Code> mode,
        which sends a real message and gives you a preview URL instead of
        delivering it.
      </P>

      <CodeBlock
        title="yatta/func/mail.ts"
        code={`export const mailer = createMailer({
  defaultFrom: "Yatta <you@ethereal.email>",
  mode: process.env.MAIL_ETHEREAL === "1" ? "ethereal" : "terminal",
});`}
      />

      <P>
        <Code>ethereal</Code> sends a real message over the network and returns a
        preview URL instead of delivering it — so you test the full path without
        spamming anyone.
      </P>

      <CodeBlock
        title="Preview"
        code={`// Compiles the template and returns the rendered email — no network.
const preview = await mailer.preview({
  to: "test@example.com",
  template: "welcome",
  data: { name: "Ada", verifyUrl: "https://app.dev/verify?t=abc" },
});

console.log(preview.subject);
console.log(preview.html);`}
      />

      <H2 id="delivery-safety">Delivery safety</H2>

      <P>
        Yatta strips CR and LF from header values, so a subject containing a
        newline cannot inject extra headers. That protection is automatic — but
        it only covers headers, not your template body.
      </P>

      <CodeBlock
        title="escaping"
        code={`// Escaped — a name containing <b> renders as literal text.
<p>Hello {{name}}</p>

// Raw — only for URLs and values you built yourself.
<a href="{{{verifyUrl}}}">Verify</a>`}
      />

      <Note>
        Use the escaped <Code>{"{{value}}"}</Code> form for anything a user
        supplied. The raw triple form is for trusted values only.
      </Note>

      <P>Rate limits are handled for you:</P>

      <CodeBlock
        code={`export const mailer = createMailer({
  defaultFrom,
  mode: "smtp",
  provider: "resend",
  rateLimit: {
    max: 100,          // messages allowed …
    window: "1h",      // … within this window
  },
});`}
      />

      <CodeBlock
        title="dry run — validate without sending"
        code={`// Compiles templates, validates headers and addresses, sends nothing.
export const mailer = createMailer({
  defaultFrom,
  mode: "smtp",
  dryRun: process.env.MAIL_DRY_RUN === "1",
});`}
      />

      <H2 id="checklist">Checklist</H2>

      <UL>
        <LI>
          <Code>mode</Code> is your provider, not <Code>terminal</Code>
        </LI>
        <LI>API key or SMTP credentials are set in the environment</LI>
        <LI>
          <Code>defaultFrom</Code> uses a domain verified with the provider
        </LI>
        <LI>
          SPF, DKIM and DMARC records are published for that domain
        </LI>
        <LI>
          You checked the provider&apos;s dashboard for rejected messages
        </LI>
        <LI>
          Send goes through a job, so a mail failure cannot fail a user request
        </LI>
      </UL>

      <P>
        For the last point, see{" "}
        <Link href="/docs/guides/background-work" className="underline underline-offset-4">
          Send email from a job
        </Link>
        .
      </P>

      <DocFooter
        prev={{ href: "/docs/mail", title: "Mail" }}
        next={{ href: "/docs/guides/oauth", title: "Sign in with Google & GitHub" }}
      />
    </article>
  );
}
