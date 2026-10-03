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
  title: "Go to production — YATTA Docs",
  description:
    "The order of operations for shipping a Yatta app: secrets, Docker, persistent volumes, probes, and the things that break only under load.",
};


export default function ProductionGuidePage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Go to production" },
        ]}
      />
      <H1 eyebrow={'Guides'} sub="Everything here is a step you can verify. Do them in order — several of them fail loudly only once real traffic arrives.">
        Go to production
      </H1>

      <H2 id="order">Order of operations</H2>

      <UL>
        <LI>Generate and set your secrets</LI>
        <LI>Point storage at S3 if you will run more than one node</LI>
        <LI>Build the image and confirm it boots locally</LI>
        <LI>Mount volumes for the database and uploads</LI>
        <LI>Wire the probes, with a grace period longer than the drain</LI>
        <LI>Send real traffic, then watch the metrics</LI>
      </UL>

      <H2 id="secrets">Secrets</H2>

      <CodeBlock
        title="generate"
        lang="bash"
        code={`openssl rand -hex 32   # → STORAGE_SECRET
openssl rand -hex 32   # → AUTH_SECRET`}
      />

      <CodeBlock
        title="environment"
        lang="bash"
        code={`NODE_ENV=production
PORT=4000

STORAGE_SECRET=…    # required; startup fails without it
AUTH_SECRET=…       # do not leave the development default

APP_URL=https://yourdomain.com
RP_ID=yourdomain.com

DATABASE_URL=/app/Database/app.db`}
      />

      <Note kind="warn">
        <Code>STORAGE_SECRET</Code> is required in production — startup fails
        without it rather than starting with an ephemeral secret that
        invalidates every signed URL on each deploy.
      </Note>

      <H2 id="the-checklist">The checklist</H2>

      <UL>
        <li>
          <Code>NODE_ENV=production</Code> — otherwise mail prints to the console
          and route hot-reloading stays on
        </li>
        <li>
          <Code>STORAGE_SECRET</Code> and <Code>AUTH_SECRET</Code> set to real
          random values
        </li>
        <li>
          Storage driver switched to <Code>s3</Code> if more than one node
        </li>
        <li>
          <Code>Database/</Code> and <Code>storage/uploads</Code> on persistent
          volumes
        </li>
        <li>
          Termination grace period longer than the 10-second drain
        </li>
        <li>
          <Code>/healthz</Code> as liveness, <Code>/readyz</Code> as readiness
        </li>
        <li>
          <Code>{"db.sql.exec(\"PRAGMA quick_check;\")"}</Code> passes before
          traffic
        </li>
      </UL>

      <H2 id="docker">Docker</H2>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`docker build -t yatta .

docker run -p 4000:4000 \\
  -e NODE_ENV=production \\
  -e STORAGE_SECRET="$(openssl rand -hex 32)" \\
  -e AUTH_SECRET="$(openssl rand -hex 32)" \\
  yatta`}
      />

      <P>
        The image runs as the non-root <Code>bun</Code> user and ships a{" "}
        <Code>HEALTHCHECK</Code> pointed at <Code>/healthz</Code>.
      </P>

      <H2 id="volumes">Volumes</H2>

      <P>
        Without these, the database disappears when the container is replaced.
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`docker run -p 4000:4000 \\
  -v yatta-data:/app/Database \\
  -v yatta-uploads:/app/storage/uploads \\
  yatta`}
      />

      <H2 id="probes">Probes and draining</H2>

      <P>
        Shutdown stops accepting connections, waits up to ten seconds for
        in-flight tasks, then terminates workers. The orchestrator has to allow
        that long or the drain never finishes.
      </P>

      <CodeBlock
        title="kubernetes"
        lang="yaml"
        code={`livenessProbe:
  httpGet: { path: /healthz, port: 4000 }
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet: { path: /readyz, port: 4000 }
  initialDelaySeconds: 5
  periodSeconds: 10

terminationGracePeriodSeconds: 20   # > the 10s drain`}
      />

      <Note>
        Liveness uses <Code>/healthz</Code>, which never touches the runtime. If
        liveness checked readiness, a busy worker pool would make the
        orchestrator kill a healthy process and cause the very outage you were
        trying to avoid.
      </Note>

      <H2 id="before-you-scale">Before you scale</H2>

      <UL>
        <LI>
          <strong className="text-[#f3eed7]/70">Multiple nodes.</strong> Local
          disk does not sync between machines. Switch the default storage disk
          to <Code>s3</Code> first.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Job throughput.</strong> Each
          process runs its own workers. Raise <Code>concurrency</Code> only as
          far as the database tolerates.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Supervision is per process.</strong>{" "}
          If a whole container dies, the load balancer must replace it — no
          in-process supervisor can observe a process that is gone. That is what
          the readiness probe is for.
        </LI>
      </UL>

      <H2 id="verify">Verifying a deploy</H2>

      <CodeBlock
        title="after shipping"
        lang="bash"
        code={`# readiness reflects the worker fleet
curl -s localhost:4000/readyz | jq '.status, .topology.totalWorkers'

# job health
sqlite3 Database/jobs.db \\
  "SELECT state, COUNT(*) FROM _yatta_jobs GROUP BY state;"

# a dead queue means handlers are failing after retries
sqlite3 Database/jobs.db \\
  "SELECT name, COUNT(*) FROM _yatta_jobs WHERE state='dead' GROUP BY name;"`}
      />

      <P>
        For the full picture see{" "}
        <Link href="/docs/deployment" className="underline underline-offset-4">
          Deployment
        </Link>{" "}
        and{" "}
        <Link href="/docs/reliability" className="underline underline-offset-4">
          Reliability
        </Link>
        .
      </P>

      <DocFooter
        prev={{
          href: "/docs/guides/background-work",
          title: "Send email from a job",
        }}
        next={{ href: "/docs/runtime", title: "Worker runtime" }}
      />
    </article>
  );
}
