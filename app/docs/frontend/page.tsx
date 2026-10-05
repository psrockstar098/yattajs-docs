import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import {
  H1,
  H2,
  H3,
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
  title: "Frontend — YATTA Docs",
  description:
    "One route definition, used two ways: called in process on the server, over HTTP in the browser. Typed from the same schemas, with bindings for React, Vue, Solid, Angular, Svelte, Qwik and plain pages.",
};

export default function FrontendDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Engines" },
          { label: "Frontend" },
        ]}
      />
      <H1
        eyebrow={"Engines"}
        sub="The usual split is a backend that defines behaviour and a frontend that calls it over HTTP, with a hand-written client and a copy of every type in between. That copy is what goes stale. Here the route is a plain function, and the transport is derived."
      >
        Frontend
      </H1>

      <H2>The one thing you write</H2>

      <P>
        A route is a schema plus a function. The function returns a plain value,
        not a <Code>Response</Code> — which is what lets the same function be
        called directly instead of reached over HTTP.
      </P>

      <CodeBlock
        title="api-contract.ts"
        code={`import { z } from "zod";
import { defineRoute, createApp } from "yatta/universal";
import { HttpError } from "yatta/api";

export const User = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
});

export const api = createApp(
  {
    getUser: defineRoute(
      {
        method: "get",
        path: "/users/:id",
        params: z.object({ id: z.string() }),
        response: User,
      },
      async ({ params, services }) => {
        const user = await services.db.users.findById(params.id);
        if (!user) throw new HttpError(404, "No such user");
        return user;
      },
    ),

    createUser: defineRoute(
      {
        method: "post",
        path: "/users",
        body: z.object({ email: z.string(), name: z.string() }),
        response: User,
      },
      async ({ body, services }) => services.db.users.insert(body),
    ),
  },
  { services: { db, auth, realtime } },
);`}
      />

      <P>
        The services are injected, so a handler uses your database, your auth and
        your realtime directly — and a test can pass a stand-in instead.
      </P>

      <Callout kind="note">
        <Code>services.db</Code> is typed from what you passed to{" "}
        <Code>createApp</Code>. Nothing is <Code>any</Code>, and nothing reaches for
        a module-level singleton, so two apps in one process cannot see each
        other&apos;s data.
      </Callout>

      <H2>Server: call it directly</H2>

      <P>
        The app has a method per route. On the server, call it. There is no HTTP
        hop, no serialization round trip, and no second definition to maintain.
      </P>

      <CodeBlock
        title="anywhere on the server"
        code={`// A Server Component, a job, a cron handler, a test — all the same.
const user = await api.getUser({ params: { id } });

// Typed from the route. No annotation, no interface.
const name: string = user.name;

// @ts-expect-error id must be a string
await api.getUser({ params: { id: 1 } });`}
      />

      <P>
        This is the part that matters and it is worth being clear about why. The
        caller and the handler are in the same process, with the same database
        connection, under the same trust boundary. Going out to HTTP and back
        between them buys no isolation at all — it costs a round trip, a socket,
        and a new way to fail. So it does not do that.
      </P>

      <H2>Server: serve it over HTTP</H2>

      <P>
        For a browser, the same table becomes endpoints. <Code>mount()</Code> is
        the whole transport.
      </P>

      <CodeBlock
        title="server.ts"
        code={`import { mount } from "yatta/universal";
import { api } from "./api-contract";

Bun.serve({ fetch: mount(api) });`}
      />

      <H2>Browser: the same methods</H2>

      <P>
        <Code>createClient(app)</Code> derives the browser client from the same
        table. Same method names, same arguments, same return types — there is no
        client file to write.
      </P>

      <CodeBlock
        title="browser.ts"
        code={`import { createClient } from "yatta/universal";
import { api } from "./api-contract";

const client = createClient(api, { baseUrl: "/api" });

const user = await client.getUser({ params: { id } });
const name: string = user.name;

// A failure carries the status and the server's own message.
try {
  await client.getUser({ params: { id: "missing" } });
} catch (err) {
  err.status; // 404
  err.message; // "No such user" — not "Request failed"
}`}
      />

      <H2>Both paths behave the same</H2>

      <P>
        That is a property, not a hope. The validators run on both — arguments are
        checked in process as well as over HTTP — so a value one refuses cannot be
        accepted by the other, and a handler that drifts from its declared response
        fails the same way on both.
      </P>

      <UL>
        <LI>
          A bad body is a <Code>400</Code> naming the field, on both paths.
        </LI>
        <LI>
          An <Code>HttpError</Code> keeps its status; anything else becomes a 500
          with <Code>&quot;Internal error&quot;</Code> — an unexpected message is
          never echoed to the caller.
        </LI>
        <LI>
          Nothing returned is a legitimate answer, not a JSON parse failure.
        </LI>
        <LI>
          A path that exists but not for this verb is a <Code>405</Code> with an{" "}
          <Code>Allow</Code> header, not a <Code>404</Code> that sends you hunting
          for a typo in a correct path.
        </LI>
      </UL>

      <H2>Frameworks</H2>

      <P>
        The loading, de-duplication, sharing between readers and rollback all live
        once, in the binding layer. Each framework adds only the line that connects
        its reactivity to a value changing — a signal write, a ref assignment, a
        resource. So the caching behaves identically everywhere, because there is
        only one implementation of it.
      </P>

      <H3>React</H3>

      <CodeBlock
        title="app/profile/[id]/page.tsx"
        code={`"use client";
import { useCall, useRoutes } from "yatta/react";
import { api } from "@/api-contract";
import { use } from "react";

export default function Page({ params }) {
  const { params: p } = use(params);
  const routes = useRoutes(api);
  const { data, error, refetch } = useCall(routes.getUser, { params: { id: p.id } });

  if (error) return <p>{error.message}</p>;
  return <h1>{data?.name ?? "…"}</h1>;
}`}
      />

      <P>
        The method and its arguments are the whole API. No wrapper function per
        endpoint, no dependency array, and no name string to keep in step.
      </P>

      <Callout kind="note">
        React destructures flat, Vue reads <code>state.value</code>, Solid returns
        an accessor. The shape follows each framework&apos;s idiom — what is
        identical across all of them is the caching, the de-duplication and the
        rollback underneath.
      </Callout>

      <H3>Vue</H3>

      <CodeBlock
        title="Profile.vue"
        code={`<script setup lang="ts">
import { useCall } from "yatta/frameworks";
import { api } from "@/api-contract";

const { state, reload } = useCall(store, api.getUser, { params: { id } });
</script>

<template>
  <h1 v-if="state.value.data">{{ state.value.data.name }}</h1>
  <p v-else-if="state.value.error">{{ state.value.error.message }}</p>
</template>`}
      />

      <H3>Solid</H3>

      <CodeBlock
        title="Profile.tsx"
        code={`import { useSolidCall } from "yatta/frameworks";

const user = useSolidCall(store, api.getUser, { params: { id } });

return <Show when={user().data}>{u => <h1>{u().name}</h1>}</Show>;`}
      />

      <H3>Svelte</H3>

      <CodeBlock
        title="Profile.svelte"
        code={`<script lang="ts">
  import { useSvelteCall } from "yatta/frameworks";

  const user = useSvelteCall(store, api.getUser, { params: { id: data.id } });
</script>

<h1>{user.data?.name}</h1>`}
      />

      <H3>Angular</H3>

      <CodeBlock
        title="profile.component.ts"
        code={`@Component({
  providers: [provideYatta(() => api, () => new QueryCache())],
  template: \`@if (user.state().data; as u) { {{ u.name }} }\`,
})
export class Profile {
  private readonly yatta = inject(YattaAngularClient);
  readonly user = this.yatta.call(api.getUser, { params: { id: this.id } });
}`}
      />

      <H3>Qwik</H3>

      <CodeBlock
        title="component.tsx"
        code={`import { useQwikCall } from "yatta/frameworks";

export default component$(() => {
  const call = useQwikCall(store, api.getUser, { params: { id } });
  return <h1>{call.state.value.data?.name}</h1>;
});`}
      />

      <P>
        Qwik is built on a signal and a resource rather than a subscription,
        because a Qwik container is rendered on the server, serialized, and
        resumed without re-running the component. Anything held in a closure does
        not survive that; serialized state does.
      </P>

      <H3>No framework at all</H3>

      <CodeBlock
        title="any.html"
        code={`import { createDomCall } from "yatta/frameworks";

const call = createDomCall(store, api.getUser, { params: { id } });
const off = call.subscribe((state) => {
  document.querySelector("h1").textContent = state.data?.name ?? "";
});`}
      />

      <H2>Next.js</H2>

      <P>
        One catch-all route file, and the same table. Seven named exports come
        from one call, so there is no way for one verb to get a different table
        than the others.
      </P>

      <CodeBlock
        title="app/api/[[...path]]/route.ts"
        code={`import { toNextRoute } from "yatta/next";
import { api } from "@/api-contract";

export const { GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS } = toNextRoute(api);`}
      />

      <H2>Realtime</H2>

      <P>
        The frontend observes a realtime connection you already have, rather than
        opening a second one. Two connections means two topic sets and two event
        streams, and neither is the one the server is pushing to.
      </P>

      <CodeBlock
        title="realtime"
        code={`import { createFrontend } from "yatta/frontend";
import { createRealtimeClient } from "yatta/realtime";

export const frontend = createFrontend(api, {
  baseUrl: "/api",
  realtime: createRealtimeClient({ url: "/realtime" }),
  cookieName: "session",
});

// Connection state, readable — so one component can show a banner and others
// can disable a button without keeping separate copies.
frontend.realtime.onStatus((status) => console.log(status));

// Sends made while disconnected are queued and flushed on reconnect, so a
// message is not lost because the network blinked.
await frontend.realtime.send("chat.message", { text: "hello" });`}
      />

      <H2>What is verified, and what is not</H2>

      <P>
        Stated plainly, because a framework binding that has only been typechecked
        is easy to mistake for one that works.
      </P>

      <UL>
        <LI>
          <strong>Verified</strong>: the binding layer, the plain-DOM binding, Vue
          (a real SSR render), and the mutation sequence every framework shares.
        </LI>
        <LI>
          <strong>Logic verified, rendering not</strong>: Solid. Its binding is a
          signal write and an accessor, both asserted — but producing markup needs
          Solid&apos;s compiler, which this project does not run.
        </LI>
        <LI>
          <strong>Typechecked only</strong>: Angular, Svelte and Qwik. Each needs a
          browser, a compiler or a resumable container that is not available here.
          Their code is a thin layer over the tested parts, but that is an argument,
          not evidence.
        </LI>
        <LI>
          <strong>Not verified in a browser</strong>: in-browser reconnection,
          optimistic rollback after an unmount, and hydration behaviour. No DOM is
          available in this project&apos;s test run.
        </LI>
      </UL>

      <Note kind="warn">
        The framework packages are development dependencies of the framework
        itself, used to typecheck the bindings. An app installs only the framework
        it actually uses — and React is an optional peer dependency, so a Bun
        service does not pull React in through Yatta.
      </Note>

      <DocFooter
        prev={{ href: "/docs/client", title: "Typed client" }}
        next={{ href: "/docs/realtime", title: "Realtime" }}
      />
    </article>
  );
}