import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, UL, LI, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Deployment — YATTA Docs",
  description:
    "Docker, cluster mode behind SO_REUSEPORT, persisting data, and a production checklist.",
};

export default function DeploymentDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Extending" },
          { label: "Deployment" },
        ]}
      />
      <H1 eyebrow={'Extending'} sub="One container, one volume, and a readiness probe is most of what a Yatta deployment needs.">
        Deployment
      </H1>

      <H2>Docker</H2>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`docker build -t yatta .
docker run -p 4000:4000 \\
  -e NODE_ENV=production \\
  -e STORAGE_SECRET="$(openssl rand -hex 32)" \\
  yatta`}
      />

      <P>
        The image runs as the non-root <Code>bun</Code> user, installs{" "}
        <Code>--production</Code> dependencies from a frozen lockfile, and ships
        a <Code>HEALTHCHECK</Code> pointed at <Code>/healthz</Code>.
      </P>

      <H2>Persist the data</H2>

      <P>
        SQLite files and uploaded files live on disk. Without a volume they are
        lost when the container is replaced.
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`docker run -p 4000:4000 \\
  -v yatta-data:/app/Database \\
  -v yatta-uploads:/app/storage/uploads \\
  -e STORAGE_SECRET="$(openssl rand -hex 32)" \\
  yatta`}
      />

      <Note>
        On a single node this is sufficient. If you run more than one container,
        do not share a SQLite file across nodes — move storage to S3 and put a
        real database behind <Code>yatta/db</Code>.
      </Note>

      <H2>Cluster mode</H2>

      <P>
        One process per core behind <Code>SO_REUSEPORT</Code>. SQLite is
        configured for exactly this — WAL, busy timeout, and schema creation
        under <Code>BEGIN IMMEDIATE</Code> with retries.
      </P>

      <CodeBlock
        title="terminal"
        lang="bash"
        code={`bun run cluster`}
      />

      <CodeBlock
        title="or in Docker"
        lang="bash"
        code={`# single process
docker run -e YATTA_CLUSTER_MODE=false yatta`}
      />

      <H2>Orchestrator probes</H2>

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

terminationGracePeriodSeconds: 20   # longer than the 10s drain`}
      />

      <Note kind="warn">
        <code className="font-mono text-[13px]">terminationGracePeriodSeconds</code>{" "}
        must exceed the drain window. If the orchestrator sends SIGKILL first,
        in-flight work is lost and the graceful shutdown never completes.
      </Note>

      <H2>Production checklist</H2>

      <UL>
        <LI>
          <Code>NODE_ENV=production</Code> set
        </LI>
        <LI>
          <Code>STORAGE_SECRET</Code> set to a real random value — startup fails
          otherwise
        </LI>
        <LI>
          <Code>AUTH_SECRET</Code> set, not left at its development default
        </LI>
        <LI>
          <Code>Database/</Code> and <Code>storage/uploads</Code> on persistent
          volumes
        </LI>
        <LI>
          Storage driver switched to <Code>s3</Code> if you run more than one node
        </LI>
        <LI>
          Grace period longer than the 10-second drain
        </LI>
        <LI>
          <Code>/healthz</Code> as liveness, <Code>/readyz</Code> as readiness
        </LI>
      </UL>

      <H2>What to watch</H2>

      <CodeBlock
        title="operational signals"
        lang="bash"
        code={`curl localhost:4000/readyz | jq '.topology, .inFlightTasks'

# jobs
sqlite3 Database/jobs.db \\
  "SELECT state, COUNT(*) FROM _yatta_jobs GROUP BY state;"`}
      />

      <P>
        A rising <Code>dead</Code> count means handlers are failing after retries.
        The DLQ API lists them for replay — see{" "}
        <a href="/docs/jobs" className="underline underline-offset-4">Jobs</a>.
      </P>

      <DocFooter
        prev={{ href: "/docs/config", title: "Configuration" }}
        next={undefined}
      />
    </article>
  );
}
