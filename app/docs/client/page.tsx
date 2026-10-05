import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1,
  H2,
  P,
  Note,
  Callout,
  UL,
  LI,
  Code,
  DocFooter,
  Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Typed client — YATTA Docs",
  description:
    "Write a route once and get both the server endpoint and a typed client method. No generated files, no duplicated types, no codegen step.",
};

export default function ClientDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Typed client" },
        ]}
      />
      <H1
        eyebrow={"Engines"}
        sub="Write a route once. The server reads your table to make endpoints; the browser reads the same table to make typed calls. Both read the same schema objects, so the shape of a request and a response is written one time."
      >
        Typed client
      </H1>

      <H2>The problem it removes</H2>

      <P>
        A normal API client is a second copy of your backend. Someone writes a
        method, someone hand-writes the response interface, and the two drift: a
        field gets renamed on the server, the type keeps its old name, and the
        bug shows up as <Code>undefined</Code> in a browser rather than as a
        compile error.
      </P>

      <P>
        This removes the second copy. A route is declared once; the server and the
        client are two views of that one declaration.
      </P>

      <H2>A contract file</H2>

      <P>
        Put the routes in their own file with no handlers in it. That file is safe
        to import from a browser, which is the point — a table with handlers
        attached would drag your database into the client bundle.
      </P>

      <CodeBlock
        title="api-contract.ts"
        code={`import { z } from "zod";
import { route } from "yatta.js/rpc";

export const User = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

export const routes = {
  getUser: route({
    method: "get",
    path: "/users/:id",
    params: z.object({ id: z.string() }),
    response: User,
  }),

  createUser: route({
    method: "post",
    path: "/users",
    body: z.object({ email: z.string(), name: z.string() }),
    response: User,
  }),
};`}
      />

      <P>
        Every validator is optional. A route with no body declares no body, and
        then passing one is a type error instead of a field quietly dropped on the
        floor.
      </P>

      <H2>The server</H2>

      <P>
        Handlers are passed separately, so they stay on the server.
      </P>

      <CodeBlock
        title="api-server.ts"
        code={`import { serve, fail } from "yatta.js/rpc";
import { routes } from "./api-contract";
import { db } from "./db";

export const api = serve(routes, {
  prefix: "/api",
  handlers: {
    getUser: async ({ params }) =>
      db.users.findById(params.id) ?? fail(404, "No such user"),

    createUser: async ({ body }) => db.users.insert(body),
  },
});`}
      />

      <P>
        The handler is typed against the route&apos;s own schemas, so reading a
        body field the schema does not declare is an error where you wrote it.
      </P>

      <P>
        For a short route, <Code>serverRoute()</Code> attaches the handler in
        place instead. Serve that table the same way. Use whichever reads better.
      </P>

      <CodeBlock
        title="api-server.ts"
        code={`import { serverRoute, serve, fail } from "yatta.js/rpc";

const routes = {
  getUser: serverRoute(
    { method: "get", path: "/users/:id", params: z.object({ id: z.string() }), response: User },
    async ({ params }) => db.users.findById(params.id) ?? fail(404, "No such user"),
  ),
};

export const api = serve(routes, { prefix: "/api" });`}
      />

      <H2>The browser</H2>

      <CodeBlock
        title="api-client.ts"
        code={`import { clientFor } from "yatta.js/rpc";
import { routes } from "./api-contract";

const api = clientFor(routes, { baseUrl: "/api" });

// The type comes from \`User\`. Nothing was written twice.
const user = await api.getUser({ params: { id: "42" } });
const name: string = user.name;

// A wrong type is a compile error, not a runtime surprise.
await api.createUser({ body: { email: 1, name: "Ada" } }); // ✗`}
      />

      <H2>What you stop doing</H2>

      <UL>
        <LI>
          Writing a copy of each response type. Change the schema and both sides
          change together.
        </LI>
        <LI>
          Keeping a list of URLs in step with the server. Rename a path and the
          client stops compiling.
        </LI>
        <LI>
          Writing <Code>await fetch(&hellip;)</Code> with a hand-built body and a
          cast on the result.
        </LI>
        <LI>
          Running a build step and committing a generated file that can fall out of
          date.
        </LI>
      </UL>

      <H2>Errors carry the server&apos;s own message</H2>

      <P>
        A failure is an <Code>Error</Code> with the status and the parsed body
        attached, both typed as <Code>CallError</Code>. The message is what the
        server said, so <Code>status === 404</Code> comes with{" "}
        <Code>&quot;No such user&quot;</Code> rather than a generic failure notice.
      </P>

      <CodeBlock
        title="handling a failure"
        code={`import type { CallError } from "yatta.js/client";

try {
  await api.getUser({ params: { id } });
} catch (err) {
  // 404, and "No such user" — not "Request failed with status 404".
  showError((err as CallError).message);
  if ((err as CallError).status === 404) showNotFound();
}`}
      />

      <H2>Any validator, not just Zod</H2>

      <P>
        The client and <Code>serve()</Code> work with any library that follows{" "}
        <a
          href="https://standardschema.dev"
          className="text-[#f3eed7] underline decoration-[#f3eed7]/30 underline-offset-4"
        >
          Standard Schema
        </a>{" "}
        — Zod, Valibot, ArkType. Yatta does not depend on any of them, so you
        pick one and nothing in the framework changes.
      </P>

      <CodeBlock
        title="api-contract.ts"
        code={`import * as v from "valibot";

export const User = v.object({
  id: v.string(),
  email: v.string(),
  name: v.string(),
});

// Everything else stays exactly as it was.`}
      />

      <H2>Catch a handler that drifts</H2>

      <P>
        Turn this on while you build. It checks what a handler returns against the
        response schema, so a mismatch is an error naming the field instead of an
        empty value in a browser.
      </P>

      <CodeBlock
        title="api-server.ts"
        code={`serve(routes, {
  prefix: "/api",
  handlers,
  validateResponses: true, // development only
});`}
      />

      <Note kind="warn">
        It costs one validation per request, which is why it is off by default.
        Leave it on in development and off in production.
      </Note>

      <H2>Plain routes, no table</H2>

      <P>
        <Code>yatta/client</Code> works on its own. Give it a list of method and
        path with no handlers at all, and you get the same typed methods — useful
        when your routes are plain router calls and there is no table to share.
      </P>

      <CodeBlock
        title="api-client.ts"
        code={`import { createClient, route } from "yatta.js/client";
import { z } from "zod";

const api = createClient(
  {
    getUser: route({
      method: "get",
      path: "/users/:id",
      params: z.object({ id: z.string() }),
      response: z.object({ id: z.string(), email: z.string(), name: z.string() }),
    }),
  },
  { baseUrl: "/api" },
);`}
      />

      <Callout kind="note">
        <Code>clientFor()</Code> is the one to reach for on a shared table. Plain{" "}
        <Code>createClient()</Code> on a table that carries handlers produces
        types the compiler cannot resolve, which looks like full typing and
        accepts anything.
      </Callout>

      <H2>Cookies and headers</H2>

      <P>
        <Code>onRequest</Code> runs before each call, which is where a cookie jar
        or an auth header goes. Default headers apply to every call, and any call
        can override them or pass an <Code>AbortSignal</Code>.
      </P>

      <CodeBlock
        title="api-client.ts"
        code={`const api = clientFor(routes, {
  baseUrl: "/api",
  headers: { "x-app": "web" },
  onRequest: (request) => {
    request.headers.set("authorization", \`Bearer \${token}\`);
  },
});

await api.listUsers({ headers: { "x-trace": traceId } });
await api.listUsers({ signal: controller.signal });`}
      />

      <DocFooter
        prev={{ href: "/docs/api", title: "HTTP API" }}
        next={{ href: "/docs/types", title: "Typed keys" }}
      />
    </article>
  );
}