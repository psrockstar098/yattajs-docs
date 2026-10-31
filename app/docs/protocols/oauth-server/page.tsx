import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "OAuth 2.0 server — YATTA Docs",
  description:
    "Let other apps sign users in through Yatta: code flow with PKCE, client credentials, refresh tokens.",
};

export default function OAuthServerDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "OAuth 2.0 server" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="Yatta as the login server: other apps send their users to you, and you hand back tokens.">
        OAuth 2.0 server
      </H1>

      <P>
        Your Yatta app can be the place users sign in. Another app
        registers as a client, sends its user to{" "}
        <Code>/oauth/authorize</Code>, and gets back tokens from{" "}
        <Code>/oauth/token</Code>. Three flows work: authorization code
        with PKCE, client credentials, and refresh tokens.
      </P>

      <H2>Register a client</H2>

      <P>
        Clients are listed in one environment variable, as JSON.
        Public clients (mobile apps, browser apps) leave the secret
        out — but then they must use PKCE.
      </P>

      <CodeBlock
        title="OAUTH_CLIENTS"
        code={`OAUTH_CLIENTS='[
  {
    "id": "web-app",
    "secret": "a-long-random-secret",
    "redirectUris": ["http://localhost:3000/callback"]
  },
  {
    "id": "mobile-app",
    "redirectUris": ["myapp://callback"]
  }
]'`}
      />

      <H3>Client fields</H3>

      <Props
        items={[
          { name: "id", desc: "The client_id. Required." },
          { name: "secret", desc: "Optional. Leave it out for a public client." },
          { name: "redirectUris", desc: "Allowed redirect URLs. A redirect must match one of these exactly." },
          { name: "name", desc: "Optional display name." },
        ]}
      />

      <H2>Step 1: authorize</H2>

      <P>
        Sign in to Yatta first — the user must already be signed in,
        or this answers 401 <Code>login_required</Code>. Then send the
        browser to the authorize URL. On success Yatta redirects back
        with a code.
      </P>

      <CodeBlock
        title="Send the user here"
        code={`# code_challenge = base64url(sha256(verifier)), method S256
http://localhost:4000/oauth/authorize?response_type=code
  &client_id=mobile-app
  &redirect_uri=myapp://callback
  &scope=openid%20profile
  &state=abc123
  &code_challenge=CHALLENGE&code_challenge_method=S256

# Success redirect
myapp://callback?code=CODE&state=abc123`}
      />

      <H3>Authorize parameters</H3>

      <Props
        items={[
          { name: "response_type", desc: "Only code is supported." },
          { name: "client_id", desc: "Must match a registered client." },
          { name: "redirect_uri", desc: "Must match a registered redirect URI exactly." },
          { name: "scope", desc: "Space-separated list, for example openid profile." },
          { name: "state", desc: "Optional. Returned unchanged." },
          { name: "code_challenge", desc: "Required for public clients. S256 or plain." },
          { name: "nonce", desc: "Optional. Returned inside the ID token when openid scope is asked for." },
        ]}
      />

      <H2>Step 2: swap the code</H2>

      <P>
        POST the code as a form. Prove the client with HTTP Basic
        auth, or with <Code>client_id</Code> and{" "}
        <Code>client_secret</Code> in the form body.
      </P>

      <CodeBlock
        title="Code for tokens"
        code={`curl -X POST http://localhost:4000/oauth/token \\
  -d grant_type=authorization_code \\
  -d code=CODE_FROM_STEP_1 \\
  -d redirect_uri=myapp://callback \\
  -d client_id=mobile-app \\
  -d code_verifier=YOUR_VERIFIER

# Answer
{
  "access_token": "tok_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile",
  "refresh_token": "tok_..."
  // "id_token": "..." — only when openid scope was asked for
}`}
      />

      <P>
        The code works once and lives 10 minutes. Using it twice, or
        after it expires, answers <Code>invalid_grant</Code>.
      </P>

      <H2>Step 3: refresh</H2>

      <P>
        Access tokens live 1 hour. Refresh tokens live 30 days — and
        they rotate: the old one dies the moment it is used.
      </P>

      <CodeBlock
        title="Refresh a token"
        code={`curl -X POST http://localhost:4000/oauth/token \\
  -d grant_type=refresh_token \\
  -d refresh_token=REFRESH_TOKEN \\
  -d client_id=mobile-app

# Answer: a new pair. The refresh token you just used is dead now.
{
  "access_token": "tok_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile",
  "refresh_token": "tok_..."
}`}
      />

      <Callout kind="warn">
        If a rotated-out refresh token is ever shown again, the whole
        token family is revoked at once. That is a sign the token may
        have been stolen.
      </Callout>

      <H2>Client credentials</H2>

      <P>
        Services without a user take this flow instead. It needs a
        client with a secret — a public client answers 401. There is
        no user here, so there is no refresh token and no ID token.
      </P>

      <CodeBlock
        title="Service to service"
        code={`curl -X POST http://localhost:4000/oauth/token \\
  -u web-app:a-long-random-secret \\
  -d grant_type=client_credentials \\
  -d scope=read

# Answer — access token only
{
  "access_token": "tok_...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "read"
}`}
      />

      <H2>Revoke</H2>

      <P>
        Revoking needs valid client auth, like the other token calls.
        After that it always answers 200 — even for a token that was
        never real, so nobody can probe which tokens exist.
      </P>

      <CodeBlock
        title="Revoke a token"
        code={`curl -X POST http://localhost:4000/oauth/revoke \\
  -u web-app:a-long-random-secret \\
  -d token=TOKEN_TO_REVOKE
# 200, empty body — whether the token existed or not`}
      />

      <H2>Lifetimes</H2>

      <Props
        items={[
          { name: "Authorization code", desc: "10 minutes, one use." },
          { name: "Access token", desc: "1 hour." },
          { name: "Refresh token", desc: "30 days, rotates on every use." },
        ]}
      />

      <H2>Errors</H2>

      <Props
        items={[
          { name: "invalid_client (401)", desc: "Unknown client, or a wrong secret." },
          { name: "invalid_grant (400)", desc: "Bad, used, or expired code or refresh token; or a refresh token from another client." },
          { name: "invalid_request (400)", desc: "Redirect URI does not match, a public client without PKCE, or an unknown code_challenge_method." },
          { name: "unsupported_response_type (400)", desc: "response_type was not code." },
          { name: "unsupported_grant_type (400)", desc: "grant_type is not one of the three flows." },
          { name: "login_required (401)", desc: "Nobody is signed in to Yatta for the authorize step." },
        ]}
      />

      <Note kind="warn">
        Client secrets live in the environment, never in code. Codes
        and tokens live in memory: they do not survive a restart, and
        each server node holds its own.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/webfinger", title: "WebFinger" }}
        next={{ href: "/docs/protocols/openid-connect", title: "OpenID Connect" }}
      />
    </article>
  );
}
