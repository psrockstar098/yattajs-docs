import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
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
        with PKCE (for web and mobile apps), client credentials (for
        services), and refresh tokens (which rotate: the old one dies
        the moment it is used).
      </P>

      <H2>Register a client</H2>

      <P>
        Clients are listed in one environment variable, as JSON. Public
        clients (mobile apps, browser apps) leave the secret out — but
        then they must use PKCE.
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

      <H2>Try it</H2>

      <P>
        Sign in to Yatta first, then send a browser to the authorize
        URL. Yatta redirects back with a code; swap the code for tokens.
      </P>

      <CodeBlock
        title="Code flow with PKCE"
        code={`# 1. Send the user here (code_challenge = base64url(sha256(verifier)))
http://localhost:4000/oauth/authorize?response_type=code
  &client_id=mobile-app
  &redirect_uri=myapp://callback
  &scope=openid%20profile
  &code_challenge=CHALLENGE&code_challenge_method=S256

# 2. Swap the code for tokens
curl -X POST http://localhost:4000/oauth/token \\
  -d grant_type=authorization_code \\
  -d code=CODE_FROM_STEP_1 \\
  -d redirect_uri=myapp://callback \\
  -d client_id=mobile-app \\
  -d code_verifier=YOUR_VERIFIER

# 3. Later, refresh (the old refresh token stops working)
curl -X POST http://localhost:4000/oauth/token \\
  -d grant_type=refresh_token \\
  -d refresh_token=REFRESH_TOKEN \\
  -d client_id=mobile-app`}
      />

      <Note kind="warn">
        Client secrets live in the environment, never in code. Codes and
        tokens live in memory: they do not survive a restart, and each
        server node holds its own. For more than one node, give each
        node its own clients for now. And if a rotated-out refresh token
        is ever shown again, the whole token family is revoked at once:
        that is a sign the token may have been stolen.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/webfinger", title: "WebFinger" }}
        next={{ href: "/docs/protocols/openid-connect", title: "OpenID Connect" }}
      />
    </article>
  );
}
