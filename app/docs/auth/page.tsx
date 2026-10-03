import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Authentication — YATTA Docs",
  description:
    "Users, sessions, rotating tokens, passkeys, TOTP 2FA and API keys, backed by your own SQLite database.",
};

export default function AuthDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Authentication" },
        ]}
      />
      <H1 eyebrow={'Engines'} sub="Authentication persisted through your own database rather than a vendor. Passwords use Argon2id, sessions are AES-256-GCM encrypted at rest, and tokens rotate on refresh.">
        Authentication
      </H1>

      <H2>Setup</H2>

      <P>
        <Code>createAuth</Code> takes a store, a signing secret, and optional
        email and passkey configuration. The scaffolded{" "}
        <Code>yatta/func/auth.ts</Code> already wires it to your database.
      </P>

      <CodeBlock
        title="yatta/func/auth.ts"
        code={`import { createAuth, type AuthStore } from "yatta/auth";
import { db } from "./db";
import { mailer } from "./mail";

class SQLiteAuthStore implements AuthStore {
  async findUserById(id: string) {
    const row = db.users.findById(id);
    return row ? this.toUser(row) : null;
  }

  async findUserByEmail(email: string) {
    const row = db.users.findFirst({
      where: { email: email.toLowerCase().trim() },
    });
    return row ? this.toUser(row) : null;
  }

  async createUser(data: any) {
    const row = db.users.insert({
      ...data,
      email: data.email.toLowerCase().trim(),
    });
    return this.toUser(row);
  }

  private toUser(row: any) {
    return {
      ...row,
      emailVerified: Boolean(row.emailVerified),
      twoFactorEnabled: Boolean(row.twoFactorEnabled),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    };
  }
  // …sessions, identities, tokens, passkeys, API keys
}

export const auth = createAuth({
  secret: process.env.AUTH_SECRET || "change-me-32-chars-minimum",
  store: new SQLiteAuthStore(),
  email: { mailer, appUrl: process.env.APP_URL || "http://localhost:4000" },
  passkeys: {
    rpName: "Yatta App",
    rpID: process.env.RP_ID || "localhost",
    origin: process.env.APP_URL || "http://localhost:4000",
  },
});`}
      />

      <Note>
        Store the secret in <Code>AUTH_SECRET</Code>. The fallback string above
        is a development convenience only.
      </Note>

      <H2>Users</H2>

      <CodeBlock
        title="Signup and login"
        code={`// signUp returns one of two shapes — check before destructuring.
const result = await auth.signUp({
  email: "ada@example.com",
  password: "CorrectHorseBatteryStaple123!",
  req, // optional — used for rate limiting and audit
});

if ("emailVerificationRequired" in result) {
  // No session yet; the user must confirm their address first.
} else {
  const { user, session, tokens, cookies } = result;
  // result.toResponse(body?, status?) builds the whole reply, cookies included.
}

// signIn returns { mfaRequired, userId } when a second factor is pending.
const login = await auth.signIn({
  email: "ada@example.com",
  password: "CorrectHorseBatteryStaple123!",
});

await auth.signOut(sessionToken);

// Resolve the current session from a request, a bearer token, or a raw string
const resolved = await auth.getSession(req);
const fromHeader = await auth.getSession(authorizationHeader);
const maybe = await auth.getSession(req, { autoRefresh: true });`}
      />

      <H2>Tokens</H2>

      <P>
        Signup and login return a short-lived access token and a longer refresh
        token. Refreshing rotates both, so a stolen refresh token is usable at
        most once.
      </P>

      <CodeBlock
        title="Refreshing"
        code={`const { tokens } = await auth.refresh(refreshToken);

// tokens.accessToken  — new
// tokens.refreshToken — rotated; the old one is now invalid`}
      />

      <H2>Passkeys</H2>

      <P>
        FIDO2 / WebAuthn. Registration is two steps: send options to the
        browser, then verify what comes back.
      </P>

      <CodeBlock
        title="Passkeys"
        code={`// 1. Registration — options first, then verify what came back.
// The challenge is stored server-side and returned as a property on the options.
const options = await auth.passkey.generateRegistrationOptions(userId);
// → options.challenge  (persisted for 5 minutes)

const verified = await auth.passkey.verifyRegistration(
  userId,
  response,        // from navigator.credentials.create()
  options.challenge,
);

// 2. Authentication
const authn = await auth.passkey.generateAuthenticationOptions(user.email);

const result = await auth.passkey.verifyAuthentication(
  response,        // from navigator.credentials.get()
  authn.challenge,
);

// verifyAuthentication resolves to the same shape as signIn: an AuthResult, or
// { mfaRequired: true, userId } when a second factor is still pending.`}
      />

      <H2>Two-factor authentication</H2>

      <CodeBlock
        title="TOTP"
        code={`// Start enrolment — returns a secret and otpauth URL
const { secret, recoveryCodes } = await auth.mfa.enable(userId, req);

// Confirm the first code before it counts as enabled
await auth.mfa.verify(userId, "123456");

// Later, during login, when user.twoFactorEnabled is true
const result = await auth.mfa.challenge(loginResult);`}
      />

      <H2>API keys</H2>

      <CodeBlock
        title="API keys"
        code={`const { apiKey, record } = await auth.apiKeys.create(user.id, {
  name: "Production CLI",
  scopes: ["read:data", "write:data"],
});

// apiKey  → shown once, e.g. "yk_live_..."
// record  → the stored row

const principal = await auth.apiKeys.authenticate(rawKey);
// checks the hash and scopes

await auth.apiKeys.revoke(record.id);`}
      />

      <H2>Permissions</H2>

      <CodeBlock
        title="RBAC"
        code={`const check = auth.permissions.check(user.roles, "delete", "posts");

// Inline, for templates
check.ifCan(user, "edit", "post", { isOwner: post.authorId === user.id });
check.denyUnless(user, "admin", "billing");`}
      />

      <P>Define roles with <Code>accesscontrol</Code> and reuse them:</P>

      <CodeBlock
        code={`import { createAuth } from "yatta/auth";
import * as ac from "accesscontrol";

const roles = {
  user: { read: ["own"] },
  admin: { read: ["any"], edit: ["any"], delete: ["any"] },
};

export const auth = createAuth({
  /* ... */
  permissions: ac.define(roles),
});`}
      />

      <H2>Rate limiting</H2>

      <P>
        Failed sign-ins are throttled per IP and per account. Exceeding the
        limit throws <Code>RateLimitError</Code> (HTTP 429).
      </P>

      <CodeBlock
        code={`import { auth, RateLimitError } from "yatta/auth";

try {
  await auth.signIn({ email, password, req });
} catch (err) {
  if (err instanceof RateLimitError) {
    return new Response("Too many attempts", { status: 429 });
  }
  throw err;
}`}
      />

      <H2>Using it in a route</H2>

      <CodeBlock
        title="yatta/backend/me.ts"
        code={`import { API, createAPI } from "yatta/api";
import { auth } from "../func/auth";

const api = createAPI();

api.get(async (ctx) => {
  const token = ctx.req.headers.get("Authorization")?.replace("Bearer ", "");
  const session = await auth.getSession(token);

  if (!session) return API.json({ error: "Unauthorized" }, { status: 401 });

  return API.json({ user: session.user });
});

export default api;`}
      />

      <DocFooter
        prev={{ href: "/docs/db", title: "Database" }}
        next={{ href: "/docs/jobs", title: "Jobs & events" }}
      />
    </article>
  );
}
