import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "MCP server — YATTA Docs",
  description:
    "Every Yatta app is an MCP server at /mcp: tools made from its own collections and functions, guarded by its own auth.",
};

export default function McpDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "MCP server" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="AI agents use your app through tools made from its own surface. No install, no plugin.">
        MCP server
      </H1>

      <P>
        Every Yatta app is also an MCP server, on <Code>/mcp</Code>.
        MCP is the standard way AI agents (coding assistants, chat
        apps, automation tools) use an app: the client asks for the
        tool list, then calls tools. Yatta builds that list from
        your app itself — you write nothing extra.
      </P>

      <H2>List tools</H2>

      <P>
        The caller must be signed in — a Yatta session, or an OAuth
        access token from this same server. Without that, the answer
        is 401, and the caller learns nothing, not even the tool
        names.
      </P>

      <CodeBlock
        title="Ask for the tool list"
        code={`curl http://localhost:4000/mcp \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Answer (shortened)
{
  "jsonrpc": "2.0", "id": 1,
  "result": { "tools": [
    { "name": "list_posts", "description": "List rows in the posts collection." },
    { "name": "get_posts", "description": "Get one row from the posts collection by id." }
  ] }
}`}
      />

      <H2>The five collection tools</H2>

      <P>
        Every collection becomes five tools, named after the
        collection itself. A collection called{" "}
        <Code>posts</Code> becomes <Code>list_posts</Code>,{" "}
        <Code>get_posts</Code>, and so on.
      </P>

      <Props
        items={[
          { name: "list_<name>", desc: "List rows. Arguments: limit (default 50, at most 100), offset (default 0)." },
          { name: "get_<name>", desc: "One row by id. Argument: id (string or number)." },
          { name: "create_<name>", desc: "Create a row. Argument: fields, the row to create." },
          { name: "update_<name>", desc: "Change a row by id. Arguments: id, fields. Answers { updated: true/false }." },
          { name: "delete_<name>", desc: "Delete a row by id. Argument: id. Answers { deleted: true/false }." },
        ]}
      />

      <H2>Call a tool</H2>

      <P>
        Send <Code>tools/call</Code> with the tool name and its
        arguments. The answer comes back as text. A tool that fails
        answers with <Code>isError: true</Code> instead of crashing
        the server.
      </P>

      <CodeBlock
        title="Create a post, then read it back"
        code={`curl http://localhost:4000/mcp \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call",
       "params":{"name":"create_posts",
       "arguments":{"fields":{"title":"Hello","body":"First post"}}}}'

# Answer (shortened)
{
  "jsonrpc": "2.0", "id": 2,
  "result": { "content": [{ "type": "text",
    "text": "{\\"id\\":1,\\"title\\":\\"Hello\\",\\"body\\":\\"First post\\"}" }] }
}`}
      />

      <H2>Your own functions</H2>

      <P>
        A function you register becomes one tool under its own name,
        and it receives the caller’s user id — so it can enforce its
        own rules, like “only touch your own rows”. A function whose
        name collides with a collection tool is skipped, so every
        tool name stays unique.
      </P>

      <CodeBlock
        title="Call a function tool"
        code={`curl http://localhost:4000/mcp \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"my_function","arguments":{"text":"hello"}}}'`}
      />

      <H2>Start a session</H2>

      <P>
        There is no session id to keep. Every request stands on its
        own. Say hello with <Code>initialize</Code>, and check the
        connection with <Code>ping</Code>.
      </P>

      <CodeBlock
        title="Initialize and ping"
        code={`curl http://localhost:4000/mcp \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":4,"method":"initialize",
       "params":{"protocolVersion":"2025-06-18"}}'

# Answer
{
  "jsonrpc": "2.0", "id": 4,
  "result": {
    "protocolVersion": "2025-06-18",
    "capabilities": { "tools": {} },
    "serverInfo": { "name": "yatta", "version": "1.0.5" }
  }
}

# Ping — answers an empty result
# {"jsonrpc":"2.0","id":5,"method":"ping"} -> {"jsonrpc":"2.0","id":5,"result":{}}`}
      />

      <P>
        A request without an id is a notification: it answers 202
        with an empty body. You can also send several requests at
        once, as a JSON array, and get several answers back.
      </P>

      <H2>Errors</H2>

      <Props
        items={[
          { name: "-32700 (HTTP 400)", desc: "The body is not JSON." },
          { name: "-32600", desc: "Not a JSON-RPC 2.0 request, or no method." },
          { name: "-32601", desc: "Unknown method." },
          { name: "-32602", desc: "Unknown tool, or no tool name given." },
          { name: "isError: true", desc: "The tool itself failed. The message is in the answer text; the server stays up." },
          { name: "HTTP 405", desc: "Anything that is not a POST." },
        ]}
      />

      <H2>Turn it off</H2>

      <P>
        The endpoint is on by default. One line turns it off.
      </P>

      <CodeBlock
        title="Disable the MCP endpoint"
        code={`MCP_ENABLED=0`}
      />

      <Note kind="warn">
        Auth tables are never turned into tools: users, sessions,
        identities, verificationTokens, passkeys, and apiKeys are
        always left out, even if you ask for them. One honest limit:
        any signed-in user can use the exposed collection tools. If
        a row should only be touched by its owner, put that rule in
        a registered function — it gets the user id and can say no.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/openid-connect", title: "OpenID Connect" }}
      />
    </article>
  );
}
