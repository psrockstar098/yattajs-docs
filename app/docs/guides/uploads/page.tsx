import type { Metadata } from "next";
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
  title: "Upload files — YATTA Docs",
  description:
    "Accept a file upload, validate it against the real bytes, store it, and serve it back with correct range streaming.",
};


export default function UploadsGuidePage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Upload files" },
        ]}
      />
      <H1 eyebrow={'Guides'} sub="Accepting a file is easy. Accepting a file safely — checking that the bytes are what they claim, and not letting one user read another user's files — is the part worth copying.">
        Upload files
      </H1>

      <H2 id="the-route">The upload route</H2>

      <CodeBlock
        title="yatta/backend/upload.ts"
        code={`import { API, createAPI } from "yatta.js/api";
import { storage } from "../func/storage";

const api = createAPI();

api.post(async (ctx) => {
  const form = await ctx.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return API.json({ error: "No file uploaded" }, { status: 400 });
  }

  const result = await storage
    .file(\`avatars/\${crypto.randomUUID()}.png\`)
    .from(file)
    .maxSize("2MB")           // rejected before anything is written
    .verifyMagic()            // inspects the bytes, not the declared type
    .save();

  return API.json({ key: result.key, url: result.url }, { status: 201 });
});

export default api;`}
      />

      <H2 id="validate">Validate the real bytes</H2>

      <P>
        A browser can be told a file is a PNG. <Code>verifyMagic()</Code>{" "}
        reads the file signature instead of trusting{" "}
        <Code>file.type</Code>, which stops an attacker uploading a script under
        an image name.
      </P>

      <CodeBlock
        title="what it checks"
        lang="text"
        code={`PNG  → 89 50 4E 47
JPEG → FF D8 FF
GIF  → "GIF8"
PDF  → "%PDF"
ZIP  → "PK\\x03\\x04"`}
      />

      <Note kind="warn">
        <Code>verifyMagic()</Code> checks the type, not the intent. Pair it with{" "}
        <Code>maxSize()</Code> and store user uploads under a generated name
        rather than the one they supplied.
      </Note>

      <H2 id="serve">Serve it back</H2>

      <P>
        <Code>serve</Code> handles range requests, so a video or large PDF can be
        seeked and resumed.
      </P>

      <CodeBlock
        title="yatta/backend/files/[key].ts"
        code={`import { API, createAPI } from "yatta.js/api";
import { storage } from "../../func/storage";

const api = createAPI();

api.get(async (ctx) => {
  return storage.file(ctx.params.key).serve(ctx.req);
});

export default api;`}
      />

      <H2 id="signed-urls">Signed URLs</H2>

      <P>
        For private files, hand out a time-limited link instead of a public one.
      </P>

      <CodeBlock
        title="download link"
        code={`const url = await storage.disk("local").signedUrl("reports/q1.pdf", {
  expiresIn: "2h",
});

return API.json({ url });`}
      />

      <H2 id="user-scoped-keys">User-scoped keys</H2>

      <P>
        The security question is not &ldquo;can they fetch a file&rdquo; but
        &ldquo;can they fetch <em>someone else&apos;s</em> file&rdquo;. Scope the
        key path by user id, then check ownership.
      </P>

      <CodeBlock
        title="yatta/backend/files/[key].ts"
        code={`api.get(async (ctx) => {
  const session = await getSession(ctx.req);
  if (!session) return API.json({ error: "Unauthorized" }, { status: 401 });

  const key = ctx.params.key;                    // "user-42/avatar.png"

  // Reject anything outside the caller's own prefix.
  const expected = \`user-\${session.user.id}/\`;
  if (!key.startsWith(expected)) {
    return API.json({ error: "Forbidden" }, { status: 403 });
  }

  // Defence in depth: even a prefix guess cannot escape via "..".
  if (key.includes("..")) {
    return API.json({ error: "Forbidden" }, { status: 403 });
  }

  return storage.file(key).serve(ctx.req);
});`}
      />

      <Note>
        Key sanitisation runs inside the storage layer too — path traversal is
        rejected there — but authorising in the route is what actually matters.
        The check belongs where you can read the session.
      </Note>

      <H2 id="using-s3">Using S3 instead</H2>

      <P>
        Switch the default disk and nothing else changes: the same routes serve
        the same keys.
      </P>

      <CodeBlock
        title="yatta/func/storage.ts"
        code={`export const storage = createStorage({
  default: "s3",              // ← was "local"
  disks: {
    local: { driver: "local", baseDir: "./storage/uploads" },
    s3: {
      driver: "s3",
      bucket: process.env.S3_BUCKET!,
      endpoint: process.env.S3_ENDPOINT,       // R2 / MinIO / S3
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
});`}
      />

      <Note kind="warn">
        Local disk is per-machine. If you run more than one container or node,
        local storage will serve different bytes on each. This is the one
        setting that must change before scaling out.
      </Note>

      <H2 id="limits">Limits and clean-up</H2>

      <UL>
        <LI>
          Always set <Code>maxSize()</Code>. Without it a single request can
          exhaust memory.
        </LI>
        <LI>
          Use a generated filename — never the one the user uploaded.
        </LI>
        <LI>
          Serve images and PDFs from a separate disk if you need stricter
          content rules than uploads.
        </LI>
        <LI>
          Delete abandoned uploads with a cron job;{" "}
          <a href="/docs/jobs" className="underline underline-offset-4">
            Jobs
          </a>{" "}
          makes that a few lines.
        </LI>
      </UL>

      <DocFooter
        prev={{ href: "/docs/guides/auth-middleware", title: "Protect a route" }}
        next={{
          href: "/docs/guides/background-work",
          title: "Send email from a job",
        }}
      />
    </article>
  );
}
