import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
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

      <H2>Upload and download</H2>

      <P>
        PUT stores a file. The first PUT answers 201; putting the same
        path again overwrites it and answers 204.
      </P>

      <CodeBlock
        title="PUT and GET"
        code={`# Upload a file — 201 the first time, 204 on overwrite
curl -X PUT --data-binary @report.pdf http://localhost:4000/dav/report.pdf

# Download it back
curl http://localhost:4000/dav/report.pdf -o report.pdf

# Just the headers, no body
curl -I http://localhost:4000/dav/report.pdf`}
      />

      <P>
        GET on a folder does not return XML. It returns a plain text
        list, one path per line, with a trailing slash on folders —
        and <Code>(empty)</Code> when there is nothing in it.
      </P>

      <CodeBlock
        title="List a folder with GET"
        code={`curl http://localhost:4000/dav/docs/

# Answer
report.pdf
notes/
# (empty) if the folder has nothing in it`}
      />

      <H2>Make folders, move, copy</H2>

      <P>
        MKCOL makes one folder. Its parent must already exist, or you
        get a 409.
      </P>

      <CodeBlock
        title="Folders and moves"
        code={`# Make a folder — 201
curl -X MKCOL http://localhost:4000/dav/docs

# Move a file into it — 201 (or 204 if it overwrites)
curl -X MOVE \\
  -H "Destination: http://localhost:4000/dav/docs/report.pdf" \\
  http://localhost:4000/dav/report.pdf

# Copy instead of moving — the source stays put
curl -X COPY \\
  -H "Destination: http://localhost:4000/dav/docs/report-copy.pdf" \\
  http://localhost:4000/dav/report.pdf

# Delete a file or an empty folder — 204
curl -X DELETE http://localhost:4000/dav/docs/report-copy.pdf`}
      />

      <Callout>
        The Destination must be a full URL on this same server, under{" "}
        <Code>/dav</Code>. A destination on another host, or outside{" "}
        <Code>/dav</Code>, is refused with a 400. A destination that
        already exists is refused with a 412 — there is no overwrite
        flag. And a destination inside the source itself is refused
        with a 400.
      </Callout>

      <H2>List with PROPFIND</H2>

      <P>
        PROPFIND returns XML, not a plain list. Depth 0 describes just
        the path you asked about; Depth 1 adds its children. Send one
        of those two — leaving Depth out answers 403.
      </P>

      <CodeBlock
        title="PROPFIND, Depth 1"
        code={`curl -X PROPFIND -H "Depth: 1" http://localhost:4000/dav/docs/

# Answer (shortened) — 207 Multi-Status
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/docs/</D:href>
    <D:propstat><D:prop>
      <D:displayname>docs</D:displayname>
      <D:resourcetype><D:collection/></D:resourcetype>
    </D:prop></D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/docs/report.pdf</D:href>
    <D:propstat><D:prop>
      <D:displayname>report.pdf</D:displayname>
      <D:resourcetype/>
      <D:getcontentlength>18204</D:getcontentlength>
    </D:prop></D:propstat>
  </D:response>
</D:multistatus>`}
      />

      <H3>Properties on every entry</H3>

      <Props
        items={[
          { name: "displayname", desc: "The file or folder name." },
          { name: "resourcetype", desc: "Contains collection for folders, empty for files." },
          { name: "getcontentlength", desc: "File size in bytes. Files only." },
        ]}
      />

      <H2>Lock a file</H2>

      <P>
        LOCK takes an exclusive write lock. Other writes to that path
        are then refused with a 423 until you unlock it or show the
        token. A lock on a folder covers everything under it.
      </P>

      <CodeBlock
        title="Lock, write, unlock"
        code={`# Lock — the answer carries the token in the Lock-Token header
curl -X LOCK -H "Content-Type: application/xml" \\
  --data '<D:lockinfo xmlns:D="DAV:"><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype><D:owner>ada</D:owner></D:lockinfo>' \\
  http://localhost:4000/dav/report.pdf
# Lock-Token: <opaquelocktoken:abc123>

# Write without the token — 423 Locked
curl -X PUT --data-binary @new.pdf http://localhost:4000/dav/report.pdf

# Write with the token — goes through
curl -X PUT -H "Lock-Token: <opaquelocktoken:abc123>" \\
  --data-binary @new.pdf http://localhost:4000/dav/report.pdf

# Unlock — 204 (a wrong token gets 409)
curl -X UNLOCK -H "Lock-Token: <opaquelocktoken:abc123>" \\
  http://localhost:4000/dav/report.pdf`}
      />

      <P>
        A lock lasts until you unlock it, or until the Timeout you
        asked for runs out. Ask with a <Code>Timeout</Code> header in
        seconds — the longest it can be is 24 hours.
      </P>

      <H2>Methods</H2>

      <Props
        items={[
          { name: "OPTIONS", desc: "Answers Dav: 1, 2 plus the Allow list." },
          { name: "GET", desc: "Download a file, or list a folder as plain text." },
          { name: "HEAD", desc: "Same as GET, with no body." },
          { name: "PUT", desc: "Store a file. 201 new, 204 overwrite. 409 if the parent folder is missing, 405 on a folder." },
          { name: "MKCOL", desc: "Make a folder. 201. 415 if you send a body, 409 if the parent is missing, 405 if it already exists." },
          { name: "DELETE", desc: "Delete a file or folder. 204. Refused with 423 while anything inside is locked." },
          { name: "MOVE / COPY", desc: "Move or copy to a Destination URL. 201 new, 204 overwrite, 412 if the destination exists." },
          { name: "LOCK", desc: "Exclusive write lock. Returns the token in the Lock-Token header." },
          { name: "UNLOCK", desc: "Release a lock. 204. 409 if the token does not match." },
          { name: "PROPFIND", desc: "XML listing. Depth 0 or 1 only; anything else is 403. Answers 207." },
        ]}
      />

      <Callout>
        The root collection itself cannot be deleted, moved, or
        copied — those answer 403. Deleting or moving a folder is
        refused with 423 while anything inside it is locked.
      </Callout>

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
