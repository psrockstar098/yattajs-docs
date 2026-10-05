import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Callout, DocFooter, Code, Breadcrumb,
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
  store: new SQLiteAuthStore(),   // required in production
  email: { mailer, appUrl: process.env.APP_URL || "http://localhost:4000" },
  passkeys: {
    rpName: "Yatta App",
    rpID: process.env.RP_ID || "localhost",
    origin: process.env.APP_URL || "http://localhost:4000",
  },
});`}
      />

      <Note kind="warn">
        <strong>A store is required in production.</strong> Omit it and{" "}
        <Code>createAuth</Code> throws. The in-memory default is a linear scan per
        lookup and enforces nothing — two concurrent signups for one address both
        succeed, because uniqueness is a scan rather than a constraint. That is fine
        for a script or a test, which is why it still defaults outside production.
      </Note>

      <Note kind="warn">
        Session expiry is checked by <Code>getSession</Code> itself, not left to the
        store. The in-memory store filters expired sessions out of its own scan, so
        the default made this look handled — but <Code>AuthStore</Code> is a
        published interface, and a custom store that returns an expired session makes
        every caller believe a dead session is live. &ldquo;The default happens to
        check&rdquo; is not a security property.
      </Note>

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

// With 2FA on, signIn returns { mfaRequired, ticket, expiresInSec } instead.
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
// { mfaRequired: true, ticket, expiresInSec } when a second factor is pending.
// Either way, completeMfa({ ticket, code }) finishes the sign-in.`}
      />

      <H2>Two-factor authentication</H2>

      <CodeBlock
        title="Enrolling"
        code={`// 1. Start. Returns a base32 secret and an otpauth:// URL for a QR code.
//    The secret is held encrypted, keyed by user id.
const { secret, uri } = await auth.mfa.beginSetup(userId, "Acme");

// 2. Confirm with the first code. Only now does 2FA count as enabled.
const { recoveryCodes } = await auth.mfa.confirmSetup(userId, "123456");

// Show the recovery codes once. Each one works once, in place of a TOTP code.`}
      />

      <CodeBlock
        title="Signing in with 2FA on"
        code={`// Every sign-in route stops here when the account has 2FA on: password,
// passkey, OAuth and magic link alike.
const pending = await auth.signIn({ email, password });

if (pending.mfaRequired) {
  // \`ticket\` is signed, short-lived (5 minutes by default) and single-use.
  // \`expiresInSec\` is there so a UI can count down.
  return renderSecondFactor(pending.ticket, pending.expiresInSec);
}

// Then the user types a code, and you finish the sign-in:
const result = await auth.completeMfa({
  ticket,
  code: "123456",        // or: recoveryCode: "a1b2-c3d4"
});`}
      />

      <Callout kind="warn">
        <strong>A ticket, not a user id.</strong> These flows used to return{" "}
        <Code>mfaRequired: true, userId</Code> and nothing else, so a 2FA user could
        not sign in by passkey, OAuth or magic link at all — and whatever second step
        you built had no proof the first factor had passed. The ticket is the half of
        the check that was missing.
      </Callout>

      <CodeBlock
        title="Turning it off"
        code={`// Needs a recent-auth session, and a code — either would be enough on its own.
await auth.mfa.disable(req, "123456");`}
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
