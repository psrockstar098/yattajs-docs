import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "OpenID Connect — YATTA Docs",
  description:
    "Identity on top of OAuth: discovery, ID tokens, JWKS, userinfo.",
};

export default function OidcDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "OpenID Connect" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="Proof of who the user is, signed and checkable by anyone. Built on the OAuth server.">
        OpenID Connect
      </H1>

      <P>
        OpenID Connect adds identity to OAuth. When a client asks for
        the <Code>openid</Code> scope, the token reply also carries an{" "}
        <Code>id_token</Code>: a signed statement saying who the user
        is. Any client can check it against the public key on{" "}
        <Code>/oauth/jwks</Code>.
      </P>

      <H2>Try it</H2>

      <P>
        Ask for the openid scope, then read the ID token and the
        userinfo endpoint.
      </P>

      <CodeBlock
        title="Login with openid scope"
        code={`# 1. Authorize with scope=openid profile email (see OAuth 2.0 server)
# 2. Swap the code — the reply now includes id_token
curl -X POST http://localhost:4000/oauth/token \\
  -d grant_type=authorization_code \\
  -d code=CODE -d redirect_uri=myapp://callback \\
  -d client_id=mobile-app -d code_verifier=VERIFIER

# 3. Who is this token for?
curl http://localhost:4000/oauth/userinfo \\
  -H "Authorization: Bearer ACCESS_TOKEN"`}
      />

      <P>
        userinfo only answers tokens that carry the <Code>openid</Code>{" "}
        scope. A plain API token without it gets a 403, even if the
        token itself is valid.
      </P>

      <H2>Discovery</H2>

      <P>
        Clients find every endpoint in one place, with no guessing:
      </P>

      <CodeBlock
        title="Discovery document"
        code={`curl http://localhost:4000/.well-known/openid-configuration

# Answer (shortened)
{
  "issuer": "http://localhost:4000",
  "authorization_endpoint": "http://localhost:4000/oauth/authorize",
  "token_endpoint": "http://localhost:4000/oauth/token",
  "userinfo_endpoint": "http://localhost:4000/oauth/userinfo",
  "jwks_uri": "http://localhost:4000/oauth/jwks",
  "id_token_signing_alg_values_supported": ["RS256"]
}`}
      />

      <Note kind="warn">
        ID tokens are signed with RS256. The signing key is made when
        the server first needs it and does not survive a restart — old
        ID tokens stop verifying after one. That is fine for
        short-lived tokens.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/oauth-server", title: "OAuth 2.0 server" }}
        next={{ href: "/docs/protocols/mcp", title: "MCP server" }}
      />
    </article>
  );
}
