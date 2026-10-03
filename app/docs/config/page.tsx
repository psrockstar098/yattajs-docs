import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Configuration — YATTA Docs",
  description:
    "Environment variables and their defaults, validation that fails fast, health probes for orchestrators, and the security headers applied to responses.",
};

export default function ConfigDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Extending" },
          { label: "Configuration" },
        ]}
      />
      <H1 eyebrow={'Extending'} sub="Configuration is validated before anything boots. A malformed value stops the process immediately rather than failing halfway through startup.">
        Configuration
      </H1>

      <H2>Environment variables</H2>

      <Props
        items={[
          {
            name: "PORT",
            type: "number",
            desc: "Defaults to 4000. Must be 1–65535; non-numeric values are rejected.",
          },
          {
            name: "NODE_ENV",
            type: '"production" | "development" | "test"',
            desc: "Defaults to development.",
          },
          {
            name: "STORAGE_SECRET",
            type: "string",
            desc: (
              <>
                Signs storage URLs.{" "}
                <strong className="text-[#f3eed7]/70">Required when NODE_ENV=production.</strong>{" "}
                Outside production a temporary secret is generated and a warning is
                logged.
              </>
            ),
          },
          {
            name: "DATABASE_URL",
            type: "string",
            desc: "SQLite file path. Defaults to Database/app.db.",
          },
          {
            name: "AUTH_SECRET",
            type: "string",
            desc: "Sign and verify auth tokens. Set this explicitly in production.",
          },
          {
            name: "APP_URL",
            type: "string",
            desc: "Used in verification links and the WebAuthn origin.",
          },
        ]}
      />

      <H2>Validation</H2>

      <P>
        Values are checked at boot. A problem stops the process with a readable
        message rather than surfacing later as a confusing error.
      </P>

      <CodeBlock
        title="startup output"
        lang="text"
        code={`EnvValidationError: Invalid environment configuration:
  - PORT must be a number, received "4000abc"
  - STORAGE_SECRET is required when NODE_ENV=production`}
      />

      <Note kind="warn">
        An ephemeral <Code>STORAGE_SECRET</Code> invalidates every signed URL
        on restart. In production this fails startup instead — which is the
        behaviour you want.
      </Note>

      <H2>Health probes</H2>

      <P>
        Two endpoints, served before anything else so they stay responsive under
        load.
      </P>

      <CodeBlock
        title="probes"
        lang="json"
        code={`GET /healthz
  → 200 { "status": "ok" }

GET /readyz
  → 200 {
      "status": "ready",
      "topology": {
        "cpuCores": 2,
        "cpuWorkers": 1,
        "ioWorkers": 2,
        "totalWorkers": 3
      },
      "inFlightTasks": 0
    }
  → 503 when the fleet has no workers`}
      />

      <Note>
        Liveness never touches the runtime. If readiness were used as a liveness
        signal, a busy worker pool would make the orchestrator kill a perfectly
        healthy process.
      </Note>

      <H2>Security headers</H2>

      <P>Applied to every routed response:</P>

      <CodeBlock
        lang="text"
        code={`X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 0
Strict-Transport-Security: max-age=31536000; includeSubDomains   ← HTTPS only`}
      />

      <Note>
        HSTS is sent only over real HTTPS — including when a proxy forwards{" "}
        <Code>x-forwarded-proto: https</Code>. Sending it over plain HTTP can
        lock a local development origin out of the browser.
      </Note>

      <H2>Storage secrets</H2>

      <P>
        Generating one for development is convenient, but generate a real one for
        anything shared:
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`openssl rand -hex 32`}
      />

      <DocFooter
        prev={{ href: "/docs/types", title: "Typed keys" }}
        next={{ href: "/docs/deployment", title: "Deployment" }}
      />
    </article>
  );
}
