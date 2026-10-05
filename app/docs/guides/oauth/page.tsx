import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1,
  H2,
  P,
  UL,
  LI,
  Note,
  Callout,
  DocFooter,
  Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Sign in with Google & GitHub — YATTA Docs",
  description:
    "Add Google and GitHub sign-in with OAuth 2.0, PKCE, and account linking — including registering your own provider and the callback route.",
};


export default function OauthGuidePage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Sign in with Google & GitHub" },
        ]}
      />
      <H1 eyebrow={'Guides'} sub="Google and GitHub are built in. This guide covers registering your app, the two routes to write, and the mistakes that produce a redirect back with no session.">
        Sign in with Google &amp; GitHub
      </H1>

      <P>
        Yatta ships an OAuth subsystem with Google and GitHub pre-registered.
        You add credentials, write two routes, and identity linking, PKCE and
        state validation are handled for you.
      </P>

      <H2 id="what-happens">What happens under the hood</H2>

      <UL>
        <LI>
          <strong className="text-[#f3eed7]/70">State</strong> is a random token
          signed with HMAC. The provider returns it unchanged; a mismatch is
          rejected, which is what blocks CSRF on the callback.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">PKCE</strong> is used for Google.
          A verifier is generated, hashed into a challenge, and checked when the
          code is exchanged.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Identity linking</strong>: if an
          account with the same email already exists, it is reused instead of
          creating a duplicate.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">
            The session is issued by Yatta
          </strong>{" "}
          — the provider&apos;s token is never handed to your client.
        </LI>
      </UL>

      <H2 id="register-your-app">Register your app</H2>

      <P>Two applications, one per provider.</P>

      <CodeBlock
        title="Google — console.cloud.google.com"
        lang="text"
        code={`1. Google Cloud Console → Credentials → Create Credentials → OAuth client
2. Application type: Web application
3. Authorised redirect URIs:
     http://localhost:4000/auth/callback/google
     https://yourdomain.com/auth/callback/google
4. Copy the Client ID and Client Secret`}
      />

      <CodeBlock
        title="GitHub — github.com/settings/developers"
        lang="text"
        code={`1. Settings → Developer settings → OAuth Apps → New OAuth App
2. Homepage URL: https://yourdomain.com
3. Authorization callback URL:
     http://localhost:4000/auth/callback/github
     https://yourdomain.com/auth/callback/github
4. Generate a client secret`}
      />

      <H2 id="set-the-callback-url">Set the callback URL</H2>

      <P>
        The redirect URI must match exactly — scheme, host, path and trailing
        slash. Use <Code>localhost</Code> in development and your real domain in
        production.
      </P>

      <CodeBlock
        title="Environment"
        lang="bash"
        code={`APP_URL=http://localhost:4000        # development
APP_URL=https://yourdomain.com       # production

GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx

GITHUB_CLIENT_ID=Ov23li...
GITHUB_CLIENT_SECRET=xxxxx`}
      />

      <H2 id="google">Google</H2>

      <P>
        No code required — the provider is pre-registered and reads its
        credentials from the environment variables above.
      </P>

      <CodeBlock
        title="yatta/func/auth.ts"
        code={`export const auth = createAuth({
  secret: process.env.AUTH_SECRET!,
  store: new SQLiteAuthStore(),
  email: { mailer, appUrl: process.env.APP_URL! },
});   // google is registered automatically`}
      />

      <H2 id="github">GitHub</H2>

      <P>Also automatic, same environment variables:</P>

      <CodeBlock
        title="yatta/func/auth.ts"
        code={`// github is registered automatically too.
// The scaffolded schema already has an \`identities\` table for this.`}
      />

      <H2 id="the-two-routes">The two routes you need</H2>

      <P>
        Start sends the browser to the provider; callback receives them back and
        issues a session.
      </P>

      <CodeBlock
        title="yatta/backend/auth/[provider]/start.ts"
        code={`import { API, createAPI } from "yatta/api";
import { auth } from "../../../func/auth";

const api = createAPI();

api.get(async (ctx) => {
  const provider = ctx.params.provider;          // "google" | "github"
  const redirectUri = \`\${process.env.APP_URL}/auth/callback/\${provider}\`;

  const { url, state, codeVerifier } =
    await auth.oauth.getAuthorizationUrl(provider, redirectUri);

  // Persist state (and PKCE verifier) for the callback to check.
  await Bun.write(\`/tmp/oauth-\${state}.json\`, JSON.stringify({
    state,
    codeVerifier: codeVerifier ?? null,
  }));

  return Response.redirect(url, 302);
});

export default api;`}
      />

      <CodeBlock
        title="yatta/backend/auth/callback/[provider].ts"
        code={`import { API, createAPI } from "yatta/api";
import { auth } from "../../../func/auth";

const api = createAPI();

api.get(async (ctx) => {
  const provider = ctx.params.provider;
  const url = new URL(ctx.req.url);

  const code = url.searchParams.get("code")!;
  const state = url.searchParams.get("state")!;

  // Restore what we saved when the flow started.
  const saved = await Bun.file(\`/tmp/oauth-\${state}.json\`).json().catch(() => null);
  if (!saved) return API.json({ error: "Unknown state" }, { status: 400 });

  const result = await auth.oauth.handleCallback({
    provider,
    code,
    expectedState: saved.state,
    redirectUri: \`\${process.env.APP_URL}/auth/callback/\${provider}\`,
    codeVerifier: saved.codeVerifier ?? undefined,
    req: ctx.req,
  });

  // Issues a Yatta session; the provider token stays server-side.
  return result.toResponse ?? API.json({ user: result.user });
});

export default api;`}
      />

      <Note kind="warn">
        The saved state must survive the redirect. A file in{" "}
        <Code>/tmp</Code> works for a single process but not behind a load
        balancer. Use the cache store instead — see{" "}
        <a href="/docs/cache" className="underline underline-offset-4">
          Cache
        </a>
        .
      </Note>

      <H2 id="account-linking">Account linking</H2>

      <P>
        By default a provider identity with a verified matching email joins the
        existing user rather than creating a second account. To attach an{" "}
        <em>additional</em> provider to someone already signed in, pass the{" "}
        <Code>Request</Code>. The user is read from its own session, inside the
        function.
      </P>

      <Callout kind="warn">
        <strong>There is no user-id parameter, on purpose.</strong> This used to take{" "}
        <Code>linkToUserId</Code> and check only that the id existed. That is account
        takeover: anyone who could run their own Google sign-in and guess a
        victim&apos;s id passed their identity straight to <Code>linkIdentity</Code>,
        and from then on Google signed them in as the victim. Existence is not proof
        of identity, so the parameter is gone rather than reshaped into another
        spelling of the same hole.
      </Callout>

      <CodeBlock
        title="link a second provider"
        code={`const result = await auth.oauth.handleCallback({
  provider,
  code,
  expectedState,
  redirectUri,
  // The caller's own request. Their session cookie, or their bearer token,
  // is what decides which account this attaches to.
  req,
});`}
      />

      <CodeBlock
        title="yatta/backend/auth/link.ts"
        code={`import { API, createAPI } from "yatta/api";
import { auth } from "../../func/auth";

const api = createAPI();

api.get(async (ctx) => {
  const provider = ctx.url.searchParams.get("provider") ?? "google";
  const session = await getSession(ctx);

  if (!session) return API.json({ error: "Unauthorized" }, { status: 401 });

  const redirectUri = \`\${process.env.APP_URL}/auth/callback/\${provider}\`;
  const { url, state, codeVerifier } =
    await auth.oauth.getAuthorizationUrl(provider, redirectUri);

  // Only the PKCE verifier needs carrying. Who the user is does not: their session
  // is still on the request that comes back to the callback.
  await saveOAuthState(state, { codeVerifier });

  return Response.redirect(url, 302);
});

export default api;`}
      />

      <H2 id="other-providers">Other providers</H2>

      <P>
        Anything speaking OAuth 2.0 can be added. Pass the endpoints and a mapper
        that normalises the profile.
      </P>

      <CodeBlock
        title="Discord"
        code={`auth.oauth.registerProvider({
  name: "discord",
  clientId: process.env.DISCORD_CLIENT_ID!,
  clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  authorizeUrl: "https://discord.com/oauth2/authorize",
  tokenUrl: "https://discord.com/api/oauth2/token",
  userInfoUrl: "https://discord.com/api/users/@me",
  scopes: ["identify", "email"],
  mapProfile: (data) => ({
    id: String(data.id),
    email: String(data.email ?? ""),
    name: String(data.global_name ?? data.username),
  }),
});`}
      />

      <P>
        Set <Code>usePkce: true</Code> for providers that support it. It is
        always safe to enable.
      </P>

      <H2 id="common-problems">Common problems</H2>

      <UL>
        <LI>
          <strong className="text-[#f3eed7]/70">redirect_uri_mismatch</strong> —
          the URI registered with the provider differs by even a trailing slash.
          Copy it exactly.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Invalid or forged OAuth
          state</strong> — the state you stored was not found on callback. This
          is the anti-CSRF check working; it usually means the saved state
          expired or was stored per-process while the callback landed on
          another.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Empty session after
          callback</strong> — return <Code>result.toResponse</Code>; it carries the
          session cookie.
        </LI>
        <LI>
          <strong className="text-[#f3eed7]/70">Google consent screen not
          published</strong> — an app in &ldquo;Testing&rdquo; mode only allows
          accounts you list as test users.
        </LI>
      </UL>

      <P>
        See also{" "}
        <Link href="/docs/auth" className="underline underline-offset-4">
          Authentication
        </Link>{" "}
        for the surrounding APIs, and{" "}
        <Link
          href="/docs/guides/auth-middleware"
          className="underline underline-offset-4"
        >
          Protect a route
        </Link>{" "}
        for using the session.
      </P>

      <DocFooter
        prev={{ href: "/docs/guides/email", title: "Send real email" }}
        next={{ href: "/docs/guides/auth-middleware", title: "Protect a route" }}
      />
    </article>
  );
}
