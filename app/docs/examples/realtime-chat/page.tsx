import type { Metadata } from "next";
import {
  H1,
  H2,
  P,
  Callout,
  Breadcrumb,
  DocFooter,
} from "@/components/docs/prose";
import { CodeBlock } from "@/components/docs/code-block";

export const metadata: Metadata = {
  title: "Realtime chat — YATTA Examples",
  description:
    "A chat server where joining a room is permission-checked, presence is tracked in memory, and messages fan out through rooms rather than a global broadcast.",
};

export default function RealtimeChatExample() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Examples", href: "/docs/examples" },
          { label: "Realtime chat" },
        ]}
      />

      <H1
        eyebrow="Examples"
        sub="Rooms, permission-checked joins, presence without a database write, and the validation that stops a socket from becoming an unauthenticated write channel."
      >
        Realtime chat
      </H1>

      <P>
        A socket is a long-lived, pre-authorised connection. Almost every
        realtime bug comes from trusting something checked at connect time and
        then never checking again — so this example checks on join, on send, and
        on the payload.
      </P>

      <H2 id="setup">Server setup</H2>

      <CodeBlock
        title="yatta/func/realtime.ts"
        code={`import { createRealtime } from "yatta/realtime";
import { auth } from "./auth";
import { db } from "./db";

export interface AppRealtime {
  "chat:message":  { roomId: string; body: string; author: string };
  "chat:typing":   { roomId: string; user: string };
  "chat:presence": { roomId: string; users: string[] };
}

declare module "yatta/realtime" {
  interface RealtimeRegister {
    data: { userId: string; name: string };
    events: AppRealtime;
  }
}

export const realtime = createRealtime({
  // Every connection carries its user, resolved once per upgrade.
  async authenticate(req) {
    const found = await auth.getSession(req);
    if (!found) return null;

    return { userId: found.user.id, name: found.user.name ?? "anon" };
  },

  // Checked on every join. Returning false refuses without leaking why.
  authorize: {
    join: async (client, topic) => {
      const roomId = topic.replace(/^room:/, "");
      return canJoinRoom(client.data.userId, roomId);
    },
  },

  // Reject a malformed payload before it reaches any room.
  validate: (event, data) => {
    if (event !== "chat:message") return { valid: true };

    const body = (data as { body?: unknown }).body;
    return typeof body === "string" && body.length > 0 && body.length <= 2000
      ? { valid: true }
      : { valid: false, reason: "body must be 1–2000 characters" };
  },
});`}
      />

      <Callout kind="note">
        Three separate gates: <code>authenticate</code> once at upgrade,{" "}
        <code>authorize.join</code> per room, and <code>validate</code> per
        payload. None of them substitutes for another — a valid session is not
        the right to join every room.
      </Callout>

      <H2 id="handlers">Connection handlers</H2>

      <CodeBlock
        title="yatta/func/realtime.ts"
        code={`export const realtime = createRealtime<AppData>({
  // ...authenticate / authorize / validate above...

  handlers: {
    async onConnect(client) {
      client.join(\`user:\${client.data.userId}\`);   // personal channel
      client.send("ready", { userId: client.data.userId });
    },

    async onMessage(client, event, data) {
      if (event !== "chat:message") return;

      const { roomId, body } = data as { roomId: string; body: string };

      // Authorisation is re-checked on send, not inherited from the join.
      // Membership can be revoked while the socket stays open.
      if (!canJoinRoom(client.data.userId, roomId)) {
        client.send("error", { message: "Not a member of this room" });
        return;
      }

      const message = {
        roomId,
        body,
        author: client.data.name,
        at: new Date().toISOString(),
      };

      // Room-scoped: only subscribers to this topic receive it.
      client.to(\`room:\${roomId}\`).broadcast("chat:message", message);

      // Persist outside the fan-out so a slow write does not delay delivery.
      await db.messages.insert(message);
    },

    async onDisconnect(client) {
      await broadcastPresence(client, "left");
    },
  },
});`}
      />

      <H2 id="presence">Presence without a database write</H2>

      <P>
        Presence is derived from who is currently subscribed, so it does not
        belong in your database. Track it in memory per room and broadcast the
        new set on change.
      </P>

      <CodeBlock
        title="yatta/func/presence.ts"
        code={`// roomId -> set of userIds
const presence = new Map<string, Set<string>>();

export async function broadcastPresence(
  client: SocketClient,
  event: "joined" | "left",
) {
  const roomId = client.data.currentRoom;
  if (!roomId) return;

  const topic = \`room:\${roomId}\`;
  const room = presence.get(topic) ?? new Set<string>();

  if (event === "joined") room.add(client.data.userId);
  else room.delete(client.data.userId);

  presence.set(topic, room);

  // Everyone in the room learns who is in the room.
  client.to(topic).broadcast("chat:presence", {
    roomId,
    users: [...room],
  });
}

export function presenceCount(topic: string): number {
  return presence.get(topic)?.size ?? 0;
}`}
      />

      <CodeBlock
        title="joining from a client message"
        code={`handlers: {
  async onMessage(client, event, data) {
    if (event === "chat:join") {
      const { roomId } = data as { roomId: string };
      const topic = \`room:\${roomId}\`;

      // join() runs authorize.join and returns false on refusal.
      const ok = await client.join(topic);
      if (!ok) {
        client.send("error", { message: "Access denied" });
        return;
      }

      client.data.currentRoom = roomId;
      await broadcastPresence(client, "joined");
    }
  },
}`}
      />

      <H2 id="moderation">Moderation</H2>

      <P>
        Deleting a message has to reach sockets that are already open. Emit an
        event and let every client apply it — the server does not have to track
        which sockets have a given message on screen.
      </P>

      <CodeBlock
        title="yatta/backend/moderation.ts"
        code={`import { and } from "yatta/db";
import { realtime } from "../func/realtime";
import { requireRole } from "../func/middleware";

const mod = createAPI("/moderation");

mod.delete("/messages/:id", requireRole("moderator"), async (ctx) => {
  const deleted = await db.messages
    .where((f) => f.id.isEqualTo(ctx.params.id))
    .delete()
    .returning();

  if (deleted.length === 0) throw new HttpError(404, "Not found");

  // Every open client in that room removes it.
  realtime.to(\`room:\${deleted[0].roomId}\`).send("chat:deleted", {
    id: deleted[0].id,
  });

  return new Response(null, { status: 204 });
});`}
      />

      <H2 id="history">Loading history</H2>

      <P>
        A socket has no memory of before it connected. History comes from the
        database over HTTP; the socket only carries what happens next.
      </P>

      <CodeBlock
        title="yatta/backend/rooms.ts"
        code={`rooms.get("/:id/messages", async (ctx) => {
  const userId = (ctx.state.user as { id: string }).id;

  if (!canJoinRoom(userId, ctx.params.id)) {
    throw new HttpError(403, "Not a member");
  }

  const cursor = ctx.query().cursor;

  const messages = await db.messages
    .where((f) => and(
      f.roomId.isEqualTo(ctx.params.id),
      f.id.isLessThan(cursor ?? "ffffffff"),
    ))
    .orderBy({ id: "desc" })
    .limit(50)
    .all();

  return Response.json({
    items: messages.reverse(),
    nextCursor: messages[0]?.id ?? null,
  });
});`}
      />

      <H2 id="client">The browser client</H2>

      <CodeBlock
        title="public/chat.js"
        code={`const ws = new WebSocket(\`ws://\${location.host}/ws\`);

ws.addEventListener("open", () => {
  ws.send(JSON.stringify({ event: "chat:join", data: { roomId } }));
});

ws.addEventListener("message", (e) => {
  const { event, data } = JSON.parse(e.data);

  switch (event) {
    case "ready":        render.self(data.userId); break;
    case "chat:message": append(data); break;
    case "chat:presence": render.avatars(data.users); break;
    case "chat:deleted": remove(data.id); break;
    case "error":        toast(data.message); break;
  }
});

function send(roomId, body) {
  // Reconnecting is the client's job — the server drops the socket on
  // disconnect and the join has to happen again.
  if (ws.readyState !== WebSocket.OPEN) {
    pending.push([roomId, body]);
    return;
  }
  ws.send(JSON.stringify({ event: "chat:message", data: { roomId, body } }));
}

// Flush anything queued while the socket was down.
ws.addEventListener("open", () => {
  for (const [roomId, body] of pending) send(roomId, body);
  pending = [];
});`}
      />

      <Callout kind="warn">
        A dropped socket loses every subscription. Re-issue{" "}
        <code>chat:join</code> after reconnect — otherwise the user is connected,
        authenticated, and receiving nothing, which looks identical to a server
        bug.
      </Callout>

      <H2 id="scaling">Scaling past one process</H2>

      <P>
        Room fan-out works in-process. Once you run more than one worker, a
        message published on process A never reaches a socket on process B.
        Attach a shared adapter and both processes see the same rooms.
      </P>

      <CodeBlock
        title="yatta/func/realtime.ts"
        code={`import { InMemoryPubSubAdapter } from "yatta/realtime";

export const realtime = createRealtime({
  // Default. Correct for a single process or a cluster behind one socket
  // entrypoint.
  adapter: new InMemoryPubSubAdapter(),

  // For multiple processes: anything implementing PubSubAdapter, so a Redis or
  // Postgres channel works without changing a line above.
});`}
      />

      <DocFooter
        prev={{ href: "/docs/examples/image-pipeline", title: "Image pipeline" }}
        next={{ href: "/docs/realtime", title: "Realtime" }}
      />
    </article>
  );
}
