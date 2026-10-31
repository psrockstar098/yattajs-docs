import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "WebDAV — YATTA Docs",
  description:
    "File operations over HTTP (RFC 4918) on /dav, backed by the Yatta storage engine.",
};

export default function WebDAVDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "WebDAV" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="Edit the files in your Yatta storage from any WebDAV client: Finder, Windows Explorer, or a command line tool. No extra setup.">
        WebDAV
      </H1>

      <P>
        WebDAV is file access over plain HTTP. Your Yatta server already
        serves it on <Code>/dav</Code>, backed by the same storage engine
        as uploads. Files you put there are the same files the storage
        engine sees.
      </P>

      <H2>Try it</H2>

      <P>
        Upload a file, then list the folder. No login is needed by default,
        so put the server behind your own auth when it faces the internet.
      </P>

      <CodeBlock
        title="WebDAV with curl"
        code={`# Upload a file
curl -X PUT --data-binary @report.pdf http://localhost:4000/dav/report.pdf

# List a folder
curl -X PROPFIND -H "Depth: 1" http://localhost:4000/dav/

# Make a folder, then move a file into it
curl -X MKCOL http://localhost:4000/dav/docs
curl -X MOVE -H "Destination: http://localhost:4000/dav/docs/report.pdf" \\
  http://localhost:4000/dav/report.pdf`}
      />

      <H2>What works</H2>

      <P>
        OPTIONS, GET, HEAD, PUT, MKCOL, DELETE, MOVE, COPY, LOCK, UNLOCK,
        and PROPFIND (Depth 0 and 1). Locks are exclusive write locks:
        a locked file refuses changes until the lock token is shown or
        the lock is released. A lock on a collection covers everything
        under it, and deleting or moving a collection is refused while
        anything inside it is locked. The root collection itself cannot
        be deleted, moved, or copied, and a COPY or MOVE destination
        must be on this same server and under <Code>/dav</Code>.
      </P>

      <Note kind="warn">
        WebDAV has no login of its own. On a public server, only expose{" "}
        <Code>/dav</Code> behind a proxy or middleware that checks who the
        caller is.
      </Note>

      <DocFooter
        prev={{ href: "/docs/api", title: "HTTP API" }}
        next={{ href: "/docs/protocols/grpc-web", title: "gRPC-Web" }}
      />
    </article>
  );
}
