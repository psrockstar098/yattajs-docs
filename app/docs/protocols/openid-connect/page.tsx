import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
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

      <H2>Get an ID token</H2>

      <P>
        Authorize exactly like OAuth, but ask for the openid scope.
        The token reply then includes the ID token alongside the
        access and refresh tokens.
      </P>

      <CodeBlock
        title="Login with openid scope"
        code={`# 1. Authorize with scope=openid profile email (see OAuth 2.0 server)
# 2. Swap the code — the reply now includes id_token
curl -X POST http://localhost:4000/oauth/token \\
  -d grant_type=authorization_code \\
  -d code=CODE -d redirect_uri=myapp://callback \\
  -d client_id=mobile-app -d code_verifier=VERIFIER

# Answer (shortened)
{
  "access_token": "tok_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email",
  "refresh_token": "tok_...",
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}`}
      />

      <H2>What is inside the ID token</H2>

      <P>
        A signed JWT, good for 1 hour. Which personal claims appear
        depends on the scope that was asked for.
      </P>

      <Props
        items={[
          { name: "iss", desc: "The server. APP_URL, or http://localhost:4000 when that is not set." },
          { name: "sub", desc: "The user id." },
          { name: "aud", desc: "The client id the token was made for." },
          { name: "exp / iat", desc: "Expiry (issued + 1 hour) and issued time." },
          { name: "nonce", desc: "Only when a nonce was sent to the authorize URL." },
          { name: "email", desc: "Only with the email scope, and only when the user has one." },
          { name: "name", desc: "Only with the profile scope, and only when the user has one." },
        ]}
      />

      <H2>Check it against JWKS</H2>

      <P>
        The public key lives on <Code>/oauth/jwks</Code>. Any client
        can fetch it and check the ID token signature — no shared
        secret needed.
      </P>

      <CodeBlock
        title="Fetch the public key"
        code={`curl http://localhost:4000/oauth/jwks

# Answer (shortened)
{
  "keys": [
    {
      "kty": "RSA",
      "kid": "yatta-1",
      "alg": "RS256",
      "n": "....",
      "e": "AQAB"
    }
  ]
}`}
      />

      <Note kind="warn">
        ID tokens are signed with RS256. The signing key is made when
        the server first needs it and does not survive a restart —
        old ID tokens stop verifying after one. That is fine for
        short-lived tokens.
      </Note>

      <H2>Userinfo</H2>

      <P>
        The same claims are also available as plain JSON, for a valid
        access token.
      </P>

      <CodeBlock
        title="Who is this token for?"
        code={`curl http://localhost:4000/oauth/userinfo \\
  -H "Authorization: Bearer ACCESS_TOKEN"

# Answer — claims follow the scope, like the ID token
{
  "sub": "user_1",
  "email": "ada@example.com",
  "name": "Ada"
}`}
      />

      <Props
        items={[
          { name: "401 invalid_token", desc: "No token, a bad token, an expired token, or a token with no user (client credentials tokens have none)." },
          { name: "403 insufficient_scope", desc: "A valid token without the openid scope. A plain API token cannot read profiles here." },
        ]}
      />

      <H2>Discovery</H2>

      <P>
        Clients find every endpoint in one place, with no guessing.
      </P>

      <CodeBlock
        title="Discovery document"
        code={`curl http://localhost:4000/.well-known/openid-configuration

# Answer
{
  "issuer": "http://localhost:4000",
  "authorization_endpoint": "http://localhost:4000/oauth/authorize",
  "token_endpoint": "http://localhost:4000/oauth/token",
  "userinfo_endpoint": "http://localhost:4000/oauth/userinfo",
  "jwks_uri": "http://localhost:4000/oauth/jwks",
  "response_types_supported": ["code"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": ["openid", "profile", "email"],
  "claims_supported": ["sub", "iss", "aud", "exp", "iat", "nonce", "email", "name"],
  "grant_types_supported": ["authorization_code", "client_credentials", "refresh_token"],
  "code_challenge_methods_supported": ["S256", "plain"]
}`}
      />

      <DocFooter
        prev={{ href: "/docs/protocols/oauth-server", title: "OAuth 2.0 server" }}
        next={{ href: "/docs/protocols/mcp", title: "MCP server" }}
      />
    </article>
  );
}
