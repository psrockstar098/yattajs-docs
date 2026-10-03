import type { Metadata } from "next";
import {
  H1,
  H2,
  P,
  Callout,
  Breadcrumb,
  DocFooter,
  UL,
  LI,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Sessions — YATTA Docs",
  description:
    "The complete session lifecycle in Yatta: signing up, signing in, resolving a session from a cookie, auto-refresh, signing out, and the MFA and email-verification branches that change the shape of the response.",
};

export default function SessionsGuide() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Guides" },
          { label: "Sessions" },
        ]}
      />

      <H1
        eyebrow="Guides"
        sub="Every route that touches a session, end to end — including the two cases where the return type changes shape and the naive version silently breaks."
      >
        Sessions
      </H1>

      <H2 id="the-two-cookies">The two cookies</H2>

      <P>
        A signed-in user carries two cookies. The session cookie identifies
        the session; the refresh cookie rotates it. Both are read automatically
        from every request, so you never parse them yourself.
      </P>

      <CodeBlock
        code={`yatta_session   the active session token
yatta_refresh   a rotating refresh token`}
      />

      <P>
        Rename them under <code>cookies</code> if they collide with something
        else on your domain:
      </P>

      <CodeBlock
        title="yatta/func/auth.ts"
        code={`import { createAuth } from "yatta/auth";

export const auth = createAuth({
  secret: process.env.AUTH_SECRET!,
  store: new SQLiteAuthStore(),

  cookies: {
    sessionCookieName: "myapp_session",
    refreshCookieName: "myapp_refresh",
  },
});`}
      />

      <H2 id="signup">Sign up</H2>

      <P>
        <code>signUp</code> does not have one return type. If the config allows
        unverified sessions it returns a full <code>AuthResult</code>; if it
        does not, it returns a narrower shape with no session attached. Code
        that assumes cookies always come back is the most common session bug.
      </P>

      <CodeBlock
        title="yatta/backend/auth.ts"
        code={`import { createAPI } from "yatta/api";
import { auth } from "../func/auth";

const route = createAPI("/auth");

route.post("/signup", async (ctx) => {
  const { email, password } = await ctx.json();

  const result = await auth.signUp({ email, password, req: ctx.req });

  // The verification-required branch has no session — do not read one here.
  if ("emailVerificationRequired" in result) {
    return route.json(
      { ok: true, message: "Check your email to verify your account." },
      { status: 202 },
    );
  }

  return route
    .json({ ok: true, user: result.user }, { status: 201 })
    .withCookies(api, result.cookies);
});

export default route;`}
      />

      <P>
        Branch on the discriminator rather than on the presence of a cookie.{" "}
        <code>&quot;emailVerificationRequired&quot; in result</code> narrows the
        union correctly, so <code>result.cookies</code> is typed on the other
        branch.
      </P>

      <Callout kind="warn">
        <code>result.cookies</code> does not exist on the verification branch.
        Destructuring it up front throws at runtime, and TypeScript will not
        warn you if you destructure through <code>any</code>.
      </Callout>

      <H2 id="signin">Sign in</H2>

      <P>
        <code>signIn</code> also returns a union. A user with TOTP enabled gets
        back <code>{"{ mfaRequired: true }"}</code> and no session until they
        supply a code.
      </P>

      <CodeBlock
        title="yatta/backend/auth.ts"
        code={`route.post("/signin", async (ctx) => {
  const { email, password, mfaCode, recoveryCode } = await ctx.json();

  const result = await auth.signIn({
    email,
    password,
    mfaCode,
    recoveryCode,
    req: ctx.req,
  });

  // Challenge raised — no cookies yet.
  if ("mfaRequired" in result) {
    return route.json(
      { mfaRequired: true },
      { status: 401, headers: { "WWW-Authenticate": "TOTP" } },
    );
  }

  return route
    .json({ ok: true, user: result.user })
    .withCookies(api, result.cookies);
});`}
      />

      <UL>
        <LI>
          <code>mfaCode</code> — the 6-digit code from an authenticator app
        </LI>
        <LI>
          <code>recoveryCode</code> — a single-use backup code, for when the
          device is gone
        </LI>
        <LI>
          Brute-force lockout is handled inside <code>signIn</code>. You do not
          need a rate limiter in front of it — but pass <code>req</code> so it
          can read the client IP and user agent.
        </LI>
      </UL>

      <H2 id="reading-a-session">Reading a session</H2>

      <P>
        Three methods, differing only in what they do when nobody is signed in.
      </P>

      <CodeBlock
        title="yatta/backend/me.ts"
        code={`import { createAPI } from "yatta/api";
import { auth } from "../func/auth";

const route = createAPI("/me");

// Optional — returns null when unauthenticated.
route.get(async (ctx) => {
  const user = await auth.getUser(ctx.req);
  if (!user) return route.json({ user: null });
  return route.json({ user });
});

// Required — throws UnauthorizedError when unauthenticated.
route.get("/required", async (ctx) => {
  const user = await auth.requireUser(ctx.req);
  return route.json({ user });
});

// Full detail, including the session record itself.
route.get("/session", async (ctx) => {
  const found = await auth.getSession(ctx.req);

  if (!found) return route.json({ session: null }, { status: 401 });

  return route.json({
    user: found.user,
    session: {
      id: found.session.id,
      expiresAt: found.session.expiresAt,
    },
  });
});

export default route;`}
      />

      <H2 id="auto-refresh">Auto-refresh</H2>

      <P>
        When a session token expires but the refresh token is still valid,
        <code>getSession</code> can rotate it for you. The rotated cookies come
        back as <code>newCookies</code> and you must send them, or the client
        keeps presenting a dead token and the next request fails.
      </P>

      <CodeBlock
        title="yatta/func/auth-middleware.ts"
        code={`import type { Middleware } from "yatta/api";

/**
 * Resolve the session once per request and hand it to handlers on ctx.state.
 * Auto-refresh is on, so an expired session token is rotated here rather than
 * failing the request.
 */
export const withSession: Middleware = async (ctx, next) => {
  const found = await auth.getSession(ctx.req, { autoRefresh: true });

  ctx.state.user = found?.user ?? null;
  ctx.state.session = found?.session ?? null;

  const res = await next();

  // getSession rotated the tokens: copy the new cookies onto the response the
  // handler produced, or the client keeps sending the dead token next time.
  if (!found?.newCookies?.length) return res;

  const headers = new Headers(res.headers);
  for (const cookie of found.newCookies) headers.append("Set-Cookie", cookie);

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};`}
      />

      <Callout kind="warn">
        Rebuilding the response re-wraps <code>res.body</code>, which is fine
        for a buffered response but wrong for a stream — the stream is already
        locked. On streaming routes, attach the cookies inside the handler
        instead of in middleware.
      </Callout>

      <H2 id="signout">Sign out</H2>

      <P>
        <code>signOut</code> returns the cookies it cleared rather than setting
        them, so it composes with any response shape.
      </P>

      <CodeBlock
        code={`route.post("/signout", async (ctx) => {
  const { success, cookies } = await auth.signOut(ctx.req);

  return route
    .json({ ok: success })
    .withCookies(api, cookies);
});`}
      />

      <H2 id="refresh-tokens">Refresh tokens and replay</H2>

      <P>
        Refresh tokens rotate on every use and belong to a family. Presenting a
        token that was already rotated is treated as theft: the whole family is
        revoked, so an attacker holding a stolen refresh token cannot outlive
        the legitimate client noticing.
      </P>

      <CodeBlock
        title="manual rotation — for non-browser clients"
        code={`// A mobile or CLI client that stores tokens itself rather than
// relying on cookies.
route.post("/refresh", async (ctx) => {
  const { refreshToken } = await ctx.json();

  const result = await auth.refresh(refreshToken, ctx.req);

  // Returned tokens are already rotated — persist these, discard the old one.
  return route.json({
    sessionToken: result.sessionToken,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
  });
});`}
      />

      <H2 id="verifying-email">Email verification</H2>

      <CodeBlock
        title="yatta/backend/auth.ts"
        code={`import { API } from "yatta/api";

// Send it. Returns the raw token — useful in dev, log it, do not ship it.
await auth.sendVerificationEmail(user.id);

// Consume it from the link the user clicked.
route.get("/verify", async (ctx) => {
  const token = ctx.url.searchParams.get("token");
  if (!token) return API.json({ error: "Missing token" }, { status: 400 });

  // verifyEmail consumes the token, so a replayed link finds nothing.
  const user = await auth.verifyEmail(token);

  return new Response(null, {
    status: 302,
    headers: { Location: "/signed-in" },
  });
});`}
      />

      <H2 id="password-reset">Password reset</H2>

      <CodeBlock
        title="yatta/backend/auth.ts"
        code={`// Always 202, whether or not the account exists. Returning 404
// here leaks which addresses are registered.
route.post("/forgot-password", async (ctx) => {
  const { email } = await ctx.json();

  await auth.password.requestReset(email, ctx.req);

  return route.json({ ok: true }, { status: 202 });
});

// The token arrives by email and has one hour of life.
route.post("/reset-password", async (ctx) => {
  const { token, password } = await ctx.json();

  await auth.password.reset(token, password);

  return route.json({ ok: true });
});

// For a signed-in user changing their own password.
route.post("/change-password", async (ctx) => {
  const user = await auth.requireUser(ctx.req);
  const { currentPassword, newPassword } = await ctx.json();

  await auth.password.change(user.id, currentPassword, newPassword);

  return route.json({ ok: true });
});`}
      />

      <H2 id="api-keys">API keys</H2>

      <P>
        Sessions are for people; API keys are for programs. A key authenticates
        as a user without a cookie and is verified in constant time.
      </P>

      <CodeBlock
        title="yatta/func/auth.ts"
        code={`route.post("/keys", async (ctx) => {
  const user = await auth.requireUser(ctx.req);
  const { name, scopes } = await ctx.json();

  const { rawKey, apiKey } = await auth.apiKeys.create(user.id, {
    name,
    scopes,          // optional, e.g. ["read", "write"]
    expiresAt: undefined,
  });

  // rawKey is shown exactly once. Only apiKey is stored.
  return route.json({ rawKey, key: apiKey }, { status: 201 });
});

// On the server side, accepting either a cookie or a key.
const session = await auth.getSession(ctx.req);

let user = session?.user ?? null;

if (!user) {
  const key = ctx.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (key?.startsWith("yk_live_")) {
    const verified = await auth.apiKeys.verify(key);
    user = verified?.user ?? null;
  }
}`}
      />

      <DocFooter
        prev={{ href: "/docs/guides/auth-middleware", title: "Protect a route" }}
        next={{ href: "/docs/guides/permissions", title: "Roles and permissions" }}
      />
    </article>
  );
}
