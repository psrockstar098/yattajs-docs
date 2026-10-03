import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Storage — YATTA Docs",
  description:
    "File uploads and downloads on local disk or S3, with signed URLs, magic-byte checks, and RFC 9110 range streaming.",
};

export default function StorageDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Storage" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="Uploads and downloads through one interface, whether the bytes live on local disk or in S3. Includes a built-in explorer UI, signed URLs, and correct range streaming.">
        Storage
      </H1>

      <H2>Disks</H2>

      <P>
        Configure one or more named disks. The default is used when a disk is
        not named.
      </P>

      <CodeBlock
        title="yatta/func/storage.ts"
        code={`import { createStorage } from "yatta/storage";

declare module "yatta/storage" {
  interface StorageRegister {
    disks: "local" | "s3";
  }
}

export const storage = createStorage({
  default: "local",
  disks: {
    local: {
      driver: "local",
      baseDir: "./storage/uploads",
      publicUrl: "/storage/files",
    },
    s3: {
      driver: "s3",
      bucket: process.env.S3_BUCKET || "my-bucket",
      endpoint: process.env.S3_ENDPOINT,        // R2 / MinIO
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
});`}
      />

      <Note kind="warn">
        Local disk is per-machine. Behind more than one node, point the default
        disk at <Code>s3</Code> — otherwise each node serves different bytes.
      </Note>

      <H2>Uploading</H2>

      <CodeBlock
        title="Uploads"
        code={`// Simple
await storage.disk("local").upload("avatars/1.png", buffer, {
  contentType: "image/png",
});

// Fluent, with validation
await storage
  .file("reports/2026-q1.pdf")
  .from(buffer)
  .maxSize("10MB")
  .verifyMagic()      // inspect actual bytes, not the declared type
  .hashName()          // content-addressed filename
  .save();

// From a web upload
await storage.disk("local").upload("uploads/x.png", request);`}
      />

      <H2>Reading</H2>

      <CodeBlock
        title="Downloads"
        code={`const file = await storage.disk("local").download("avatars/1.png");

await file.text();
await file.json();
await file.buffer();
await file.arrayBuffer();
await file.blob();

for await (const chunk of file.stream()) {
  // …
}`}
      />

      <H2>Serving over HTTP</H2>

      <P>
        <Code>serve</Code> implements RFC 9110 properly: byte ranges produce
        <Code> 206</Code>, conditional requests produce <Code>304</Code>, and
        unsatisfiable ranges produce <Code>416</Code>.
      </P>

      <CodeBlock
        title="yatta/backend/media/[name].ts"
        code={`import { API, createAPI } from "yatta/api";
import { storage } from "../func/storage";

const api = createAPI();

api.get(async (ctx) => {
  return storage.file(\`media/\${ctx.params.name}\`).serve(ctx.req);
});

export default api;`}
      />

      <P>
        Dragging the seek bar on a large video then resumes instead of
        re-downloading, because the range request is honoured.
      </P>

      <H2>Signed URLs</H2>

      <CodeBlock
        title="Time-limited links"
        code={`const url = await storage.disk("local").signedUrl("reports/q1.pdf", {
  expiresIn: "2h",
});

// Fluent
const url = await storage
  .file("reports/q1.pdf")
  .sign()
  .expiresIn("2h")
  .get();`}
      />

      <Note>
        Signed URLs are signed with <Code>STORAGE_SECRET</Code>. Set it in
        production — an ephemeral secret makes every link invalid after a
        restart.
      </Note>

      <H2>Listing and metadata</H2>

      <CodeBlock
        title="Browsing"
        code={`await storage.disk("local").list();
await storage.disk("local").list({ prefix: "avatars/" });

const meta = await storage.disk("local").head("avatars/1.png");
// { size, contentType, lastModified, etag }

await storage.disk("local").exists("avatars/1.png"); // boolean`}
      />

      <H2>Moving and deleting</H2>

      <CodeBlock
        title="Mutations"
        code={`await storage.disk("local").copy("a.png", "b.png");
await storage.disk("local").move("a.png", "archive/a.png");
await storage.disk("local").delete("a.png");`}
      />

      <H2>Folders</H2>

      <CodeBlock
        title="Scoped directories"
        code={`const folder = storage.folder("uploads");

await folder.put("file.txt", "hello");
await folder.list();
await folder.delete("file.txt");

await folder.file("nested/deep.bin").put(buffer);`}
      />

      <H2>Explorer UI</H2>

      <P>
        <Code>/storage</Code> serves a browsable dashboard for the default disk,
        plus a JSON listing endpoint — no extra configuration.
      </P>

      <CodeBlock
        title="Built-in routes"
        code={`GET /storage              → explorer UI
GET /storage/api/files     → JSON listing
GET /storage/files/<key>   → file contents`}
      />

      <H2>Sizes and durations</H2>

      <CodeBlock
        code={`// Sizes
"500B"  "10KB"  "5MB"  "1GB"   // strings
10485760                              // raw bytes

// Durations
"30s"  "5m"  "1h"  "7d"`}
      />

      <DocFooter
        prev={{ href: "/docs/cache", title: "Cache" }}
        next={{ href: "/docs/mail", title: "Mail" }}
      />
    </article>
  );
}
