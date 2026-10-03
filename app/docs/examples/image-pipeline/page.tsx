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
  title: "Image pipeline — YATTA Examples",
  description:
    "An upload that returns immediately: validate and store on the request, resize on a worker, emit an event, and stream progress to the browser over SSE.",
};

export default function ImagePipelineExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Image pipeline" },
        ]}
      />

      <H1
        eyebrow="Examples"
        sub="The request validates and stores the original, then gets out of the way. A worker resizes, an event fires, and progress reaches the browser over SSE."
      >
        Image pipeline
      </H1>

      <P>
        Uploading and processing an image are different problems. Holding the
        request open while three resize passes run is what makes an upload feel
        broken. Split them: the request does only what has to happen before the
        bytes are safe, everything else happens on a worker.
      </P>

      <H2 id="shape">The shape</H2>

      <CodeBlock
        code={`POST /images
  ├─ validate (magic bytes, size, type)      ~50ms
  ├─ store the original                     ~200ms
  ├─ enqueue "image:resize"                 instant
  └─ 202 { id, statusUrl }

worker runs "image:resize"
  ├─ thumb.webp / card.webp / hero.jpg
  ├─ progress(33) → progress(66) → progress(100)
  └─ emit "image.ready"

GET /images/:id/progress   (SSE)
  └─ pushes every progress tick as it happens`}
      />

      <H2 id="storage">Storage setup</H2>

      <CodeBlock
        title="yatta/func/storage.ts"
        code={`import { createStorage } from "yatta/storage";

export const storage = createStorage({
  driver: process.env.S3_BUCKET
    ? {
        type: "s3",
        bucket: process.env.S3_BUCKET,
        region: process.env.AWS_REGION!,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    : {
        type: "local",
        path: "./uploads",
      },
});`}
      />

      <Callout kind="note">
        The same code runs against local disk in development and S3 in
        production. Nothing above the driver knows the difference.
      </Callout>

      <H2 id="schema">Schema</H2>

      <CodeBlock
        title="yatta/func/db.ts"
        code={`export const schema = {
  images: {
    id: col.uuid(),
    userId: col.text().references("users.id", { onDelete: "CASCADE" }),
    originalKey: col.text(),
    status: col.text().default("pending"),   // pending | ready | failed
    error: col.text().nullable(),
    meta: col.json<Record<string, unknown>>().nullable(),
    createdAt: col.createdAt(),
    updatedAt: col.updatedAt(),
  },
};

export const db = createDatabase({ url: process.env.DATABASE_URL, schema });`}
      />

      <H2 id="events">Typed events</H2>

      <P>
        Declare the events once so <code>emit</code> and <code>on</code> are both
        checked. Getting this wrong used to silently drop the payload — the
        signature takes a transform function as its fourth argument.
      </P>

      <CodeBlock
        title="yatta/func/events.ts"
        code={`import { createEvents } from "yatta/jobs";
import { jobs } from "./jobs";

export interface AppEvents {
  "image.uploaded":  { imageId: string; userId: string };
  "image.ready":    { imageId: string; variants: string[] };
  "image.failed":   { imageId: string; error: string };
}

declare module "yatta/jobs" {
  interface EventRegister extends AppEvents {}
}

export const events = createEvents(jobs);`}
      />

      <H2 id="upload">The upload route</H2>

      <CodeBlock
        title="yatta/backend/images.ts"
        code={`import { createAPI, HttpError } from "yatta/api";
import { verifyMagicBytes, guessContentType } from "yatta/storage";
import { and } from "yatta/db";
import { db } from "../func/db";
import { storage } from "../func/storage";
import { jobs } from "../func/jobs";
import { requireAuth } from "../func/middleware";

const images = createAPI("/images");

images.use(requireAuth);

images.post("/", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;
  const form = await ctx.req.formData();

  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "file is required");

  // Cap the request body before reading it into memory.
  const MAX = 10 * 1024 * 1024;
  if (file.size > MAX) throw new HttpError(413, "File exceeds 10MB");

  // Trust the bytes, not the declared Content-Type: a .exe renamed to .jpg
  // arrives here with a perfectly valid image/jpeg header.
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!verifyMagicBytes(head)) throw new HttpError(415, "Not an image");

  const contentType = guessContentType(head) ?? file.type;
  if (!contentType.startsWith("image/")) {
    throw new HttpError(415, "Not an image");
  }

  const id = crypto.randomUUID();
  const key = \`images/\${userId}/\${id}/original\`;

  await storage.put(key).from(file.stream() as any)
    .withContentType(contentType)
    .asPrivate()
    .maxSize("10mb")
    .verifyMagic();

  const row = await db.images.insert({
    id,
    userId,
    originalKey: key,
    status: "pending",
  });

  // Fire and forget. The response does not wait for a resize.
  await jobs.enqueue("image:resize", { imageId: id }, { priority: "high" });

  return images.json(
    { id: row.id, status: row.status, progressUrl: \`/images/\${id}/progress\` },
    { status: 202 },
  );
});`}
      />

      <H2 id="worker">The worker</H2>

      <CodeBlock
        title="yatta/func/jobs.ts"
        code={`import { createJobs } from "yatta/jobs";
import { db } from "./db";
import { storage } from "./storage";
import { events } from "./events";

export const jobs = createJobs();

const VARIANTS = [
  { suffix: "thumb", width: 200,  format: "webp" },
  { suffix: "card",  width: 800,  format: "webp" },
  { suffix: "hero",  width: 2000, format: "jpeg" },
] as const;

jobs.handle("image:resize", async ({ imageId }, ctx) => {
  const image = await db.images.findById(imageId);
  if (!image) throw new Error(\`image \${imageId} vanished\`);

  try {
    const original = await storage.disk().download(image.originalKey);
    const buffer = await original.buffer();

    const variants: string[] = [];

    for (const [i, v] of VARIANTS.entries()) {
      // Progress is per-step, so the bar moves instead of sitting at zero.
      ctx.progress(
        Math.round(((i + 1) / VARIANTS.length) * 100),
        \`Generating \${v.suffix}\`,
      );

      const resized = await resize(buffer, v);
      const key = \`images/\${image.userId}/\${imageId}/\${v.suffix}.\${v.format}\`;

      await storage.put(key)
        .from(resized)
        .withContentType(\`image/\${v.format}\`)
        .asPublic()
        .maxSize("2mb");

      variants.push(key);
    }

    await db.images
      .where((f) => f.id.isEqualTo(imageId))
      .update({ status: "ready", updatedAt: new Date() });

    // The UI is already listening for this; no polling needed.
    await events.emit("image.ready", { imageId, variants });

    ctx.progress(100, "Done");
  } catch (err) {
    await db.images
      .where((f) => f.id.isEqualTo(imageId))
      .update({ status: "failed", error: String(err) });

    await events.emit("image.failed", {
      imageId,
      error: err instanceof Error ? err.message : "Unknown",
    });

    // Rethrow so the retry policy applies — a transient disk error should not
    // be permanent.
    throw err;
  }
});`}
      />

      <Callout kind="warn">
        Emitting the failure event <em>and</em> rethrowing is deliberate. The
        event updates the UI now; the rethrow hands the job to the retry policy.
        Swallowing the error would leave the row stuck as{" "}
        <code>pending</code> with no retries and no visible error.
      </Callout>

      <H2 id="progress">Streaming progress over SSE</H2>

      <P>
        <code>realtime.job(id)</code> follows a job from the worker. The browser
        subscribes over SSE and sees each tick as it happens — no polling, and
        it survives a worker restart because the tracker is keyed by job id.
      </P>

      <CodeBlock
        title="yatta/backend/images.ts"
        code={`import { SSEClient } from "yatta/realtime";
import { realtime } from "../func/realtime";

images.get("/:id/progress", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;

  // Ownership first — never let progress be a way to probe for ids.
  const image = await db.images
    .where((f) => and(
      f.id.isEqualTo(ctx.params.id),
      f.userId.isEqualTo(userId),
    ))
    .first();

  if (!image) throw new HttpError(404, "Not found");

  // Already finished? Send the terminal state and close.
  if (image.status !== "pending") {
    const client = new SSEClient(ctx.req);
    client.send("done", { status: image.status, error: image.error });
    client.close();

    return new Response(client.readable, {
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const client = new SSEClient(ctx.req);
  const tracker = realtime.job(image.id);

  // Subscribe to the live tracker.
  for await (const update of tracker) {
    client.send("progress", {
      percent: update.percent,
      message: update.message,
    });

    if (update.percent >= 100) break;
  }

  client.send("done", { status: "ready" });
  client.close();

  return new Response(client.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "Connection": "keep-alive",
    },
  });
});`}
      />

      <H2 id="serving">Serving a variant</H2>

      <P>
        <code>StorageFile.serve</code> understands range requests, so a large
        hero image can be partially re-fetched instead of re-downloaded.
      </P>

      <CodeBlock
        title="yatta/backend/images.ts"
        code={`images.get("/:id/:variant", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;

  const image = await db.images
    .where((f) => and(
      f.id.isEqualTo(ctx.params.id),
      f.userId.isEqualTo(userId),
    ))
    .first();

  if (!image || image.status !== "ready") {
    throw new HttpError(404, "Not found");
  }

  const key = \`images/\${userId}/\${image.id}/\${ctx.params.variant}\`;
  const file = await storage.disk().download(key);

  // Handles Range, ETag and conditional GET for you.
  return file.serve(ctx.req, {
    contentType: ctx.params.variant.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg",
  });
});`}
      />

      <H2 id="client">The browser</H2>

      <CodeBlock
        title="public/app.js"
        code={`const form = new FormData();
form.append("file", input.files[0]);

const res = await fetch("/images", { method: "POST", body: form });
const { id, progressUrl } = await res.json();

// The server told us where to watch.
const events = new EventSource(progressUrl);

events.addEventListener("progress", (e) => {
  const { percent, message } = JSON.parse(e.data);
  bar.style.width = \`\${percent}%\`;
  status.textContent = message;
});

events.addEventListener("done", (e) => {
  const { status, error } = JSON.parse(e.data);
  events.close();
  status.textContent = status === "ready" ? "Uploaded" : \`Failed: \${error}\`;
});`}
      />

      <Callout kind="tip">
        <code>EventSource</code> reconnects on its own, so a dropped connection
        recovers without retry logic on your side. Close it on{" "}
        <code>done</code> or it will keep reconnecting to a finished stream.
      </Callout>

      <DocFooter
        prev={{ href: "/docs/examples/todo-api", title: "Todo API" }}
        next={{ href: "/docs/guides/background-work", title: "Send email from a job" }}
      />
    </article>
  );
}
