import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
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

      <H2>What tools does my app get?</H2>

      <P>
        One tool per database collection, and one tool per function
        you register:
      </P>

      <CodeBlock
        title="Tools from a posts collection"
        code={`list_posts    # list rows (limit at most 100)
get_posts     # one row by id
create_posts  # create a row
update_posts  # change a row by id
delete_posts  # delete a row by id

say_hello     # your own function, by its own name`}
      />

      <P>
        Tool names use the collection name as-is. A function whose
        name collides with a collection tool is skipped, so every
        tool name stays unique.
      </P>

      <H2>Point a client at it</H2>

      <P>
        Any MCP client that speaks streamable HTTP works. The client
        needs no session id — every request stands on its own — and
        it must be signed in (see below). One short example with
        curl:
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

      <P>
        To call a tool, send <Code>tools/call</Code> with the tool
        name and its arguments. The answer comes back as text, and
        a tool that fails answers with <Code>isError: true</Code>{" "}
        instead of crashing the server.
      </P>

      <H2>Auth</H2>

      <P>
        The endpoint uses the same auth as the rest of your app. The
        caller must be signed in — a Yatta session, or an OAuth
        access token from this same server. A caller who is not
        signed in gets a 401 and learns nothing, not even the tool
        names.
      </P>

      <Note kind="warn">
        Auth tables are never turned into tools: users, sessions,
        api keys, and friends are always left out, even if you ask
        for them. One honest limit: any signed-in user can use the
        exposed collection tools. If a row should only be touched by
        its owner, put that rule in a registered function — it gets
        the user id and can say no. If your app must not expose its
        data to every signed-in user, turn the endpoint off with one
        line: <Code>MCP_ENABLED=0</Code>.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/openid-connect", title: "OpenID Connect" }}
      />
    </article>
  );
}
