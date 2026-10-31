import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1,
  H2,
  P,
  UL,
  LI,
  Table,
  TR,
  TD,
  Note,
  Callout,
  Code,
  DocFooter,
  Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Protocols — YATTA Docs",
  description:
    "Six wire protocols served next to your API with no setup: gRPC-Web, WebDAV, DNS over HTTPS, WebFinger, OAuth 2.0 with OpenID Connect, and MCP.",
};

export default function ProtocolsDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[{ label: "Docs", href: "/docs" }, { label: "Protocols" }]}
      />
      <H1
        eyebrow="Protocols"
        sub="Six protocols that are already listening on your app. No dependency, no plugin, no service to run — a client that speaks the protocol can talk to your app the same day you start it."
      >
        Protocols
      </H1>

      <P>
        These are not engines. Nothing is configured and nothing has to be
        started: the router answers their paths before it looks at your file
        routes, so an app with a single route still serves all six. Each one is
        a plain <Code>(req) =&gt; Promise&lt;Response&gt;</Code>, so you can also
        mount any of them yourself, elsewhere, with your own options.
      </P>

      <H2 id="endpoints">What is already mounted</H2>

      <Table
        head={["Path", "Protocol", "Turn it off"]}
      >
        <TR>
          <TD mono>/grpc-web</TD>
          <TD>
            gRPC-Web unary calls. Ships a health check and an echo; add your own
            services in code.
          </TD>
          <TD>Mount your own handler instead.</TD>
        </TR>
        <TR>
          <TD mono>/dav</TD>
          <TD>
            WebDAV over the default storage disk — Finder, Explorer, Word,
            davfs2.
          </TD>
          <TD>
            <Code>readOnly: true</Code> on your own handler.
          </TD>
        </TR>
        <TR>
          <TD mono>/dns-query</TD>
          <TD>
            DNS over HTTPS (RFC 8484), wire and JSON shapes. A and AAAA only.
          </TD>
          <TD>Mount your own handler instead.</TD>
        </TR>
        <TR>
          <TD mono>/.well-known/webfinger</TD>
          <TD>
            WebFinger (RFC 7033) discovery for accounts in the auth store.
          </TD>
          <TD>Mount your own handler instead.</TD>
        </TR>
        <TR>
          <TD mono>/oauth/*</TD>
          <TD>
            OAuth 2.0 authorize, token and revoke, plus OIDC discovery, JWKS and
            userinfo.
          </TD>
          <TD>Stop sending <Code>OAUTH_CLIENTS</Code>; there are no clients.</TD>
        </TR>
        <TR>
          <TD mono>/mcp</TD>
          <TD>
            An MCP server whose tools are generated from your collections.
          </TD>
          <TD>
            <Code>MCP_ENABLED=0</Code>.
          </TD>
        </TR>
      </Table>

      <Note kind="warn">
        <Code>/dav</Code> is mounted with <em>no authentication</em>. Anyone who
        can reach the URL can read, write and delete everything on the default
        storage disk. That is fine on localhost and wrong on the internet: pass{" "}
        <Code>authenticate</Code> and mount the handler yourself, or keep{" "}
        <Code>/dav</Code> behind the auth wall you already have.
      </Note>

      <H2 id="guides">One page per protocol</H2>

      <UL>
        <LI>
          <Link className="underline" href="/docs/protocols/grpc-web">
            gRPC-Web
          </Link>{" "}
          — protobuf calls from a browser, a codec, and a client.
        </LI>
        <LI>
          <Link className="underline" href="/docs/protocols/webdav">
            WebDAV
          </Link>{" "}
          — files over HTTP for Finder, Explorer and davfs2.
        </LI>
        <LI>
          <Link className="underline" href="/docs/protocols/doh">
            DNS over HTTPS
          </Link>{" "}
          — A and AAAA questions, in the wire and JSON shapes.
        </LI>
        <LI>
          <Link className="underline" href="/docs/protocols/webfinger">
            WebFinger
          </Link>{" "}
          — turn an <Code>acct:</Code> address into links.
        </LI>
        <LI>
          <Link className="underline" href="/docs/protocols/oauth-server">
            OAuth 2.0 server
          </Link>{" "}
          — be the login server, with PKCE and rotating refresh tokens.
        </LI>
        <LI>
          <Link className="underline" href="/docs/protocols/openid-connect">
            OpenID Connect
          </Link>{" "}
          — discovery, JWKS and signed ID tokens on top of it.
        </LI>
        <LI>
          <Link className="underline" href="/docs/protocols/mcp">
            MCP server
          </Link>{" "}
          — an agent&apos;s tools, generated from your collections.
        </LI>
      </UL>

      <H2 id="defaults">The defaults are the cautious ones</H2>

      <P>
        Each module refuses something a naive implementation would accept. The
        list matters more than the summary — these are the decisions a client
        will notice:
      </P>

      <UL>
        <LI>
          <strong>gRPC-Web</strong> requires{" "}
          <Code>Content-Type: application/grpc-web</Code>, caps a message at 4
          MB, refuses compression and streaming, and answers an unknown method
          with status 12 rather than a 404.
        </LI>
        <LI>
          <strong>WebDAV</strong> enforces locks on subtrees, requires a lock
          body for a new lock (a body-less <Code>LOCK</Code> is a refresh), and
          serves anything not on an inline allowlist as a download — a file
          someone <Code>PUT</Code> must not run on your origin.
        </LI>
        <LI>
          <strong>DNS over HTTPS</strong> answers <Code>A</Code> and{" "}
          <Code>AAAA</Code> only. A request for <Code>MX</Code> gets{" "}
          <Code>NOTIMP</Code>, not an invented A record.
        </LI>
        <LI>
          <strong>WebFinger</strong> sends <Code>Access-Control-Allow-Origin: *</Code>{" "}
          on every answer, errors included, because a browser cannot read a 404
          without it.
        </LI>
        <LI>
          <strong>OAuth 2.0</strong> demands PKCE (<Code>S256</Code> only) from
          public clients, refuses a replayed code and kills the tokens it
          produced, and checks redirect URIs when the client is registered
          rather than when a user is redirected.
        </LI>
        <LI>
          <strong>MCP</strong> never exposes an auth table, whatever its
          spelling, and answers 401 before it names a single tool.
        </LI>
      </UL>

      <H2 id="mount-yourself">Mounting one yourself</H2>

      <P>
        Every module takes a store or a lookup and returns a handler. Mounting it
        is one line, which is how the default routes are wired:
      </P>

      <CodeBlock
        title="one handler, your own options"
        code={`import { createWebDAVHandler, createStorageDavStore } from "yatta.js/webdav";
import { storage } from "./storage";

const dav = createWebDAVHandler(createStorageDavStore(storage.disk()), {
  basePath: "/dav",
  readOnly: false,
  authenticate: async (req) => {
    const user = await auth.getUser(req);
    return user !== null;
  },
});

// Bun.serve({ fetch: dav }) — or hand it to your router.`}
      />

      <P>
        The handlers are stateless except where the protocol needs state:
        WebDAV keeps locks in memory for this process, and OAuth keeps codes and
        tokens in its store. Nothing is written to disk unless you pass a store
        that writes.
      </P>

      <Callout kind="note">
        Two honest limits. WebDAV locks do not survive a restart and are not
        shared between nodes, and OAuth&apos;s default store is in memory, so a
        restart invalidates issued tokens. Both are the kind of thing that works
        on one machine and quietly does not on three.
      </Callout>

      <DocFooter
        next={{ href: "/docs/protocols/grpc-web", title: "gRPC-Web" }}
      />
    </article>
  );
}
