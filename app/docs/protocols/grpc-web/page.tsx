import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "gRPC-Web — YATTA Docs",
  description:
    "Browser clients calling Yatta services over HTTP with protobuf framing.",
};

export default function GrpcWebDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "gRPC-Web" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="Call Yatta services from a browser over plain HTTP, with real protobuf messages. No extra setup.">
        gRPC-Web
      </H1>

      <P>
        Browsers cannot speak raw gRPC, but they can speak gRPC-Web: the
        same protobuf messages, sent over a normal HTTP POST. Yatta serves
        it on <Code>/grpc-web/&lt;Service&gt;/&lt;Method&gt;</Code>.
        Only single-request, single-reply calls are supported — no
        streaming.
      </P>

      <H2>Try it</H2>

      <P>
        The built-in Echo service sends your message straight back. The
        client helper below works in the browser and in Bun.
      </P>

      <CodeBlock
        title="Call Echo from the browser"
        code={`import { grpcWebCall, encodeStringField, decodeMessage, fieldString }
  from "yatta.js/grpcweb";

const reply = await grpcWebCall(
  "http://localhost:4000/grpc-web",
  "yatta.Echo",
  "Echo",
  encodeStringField(1, "hello"),
);
console.log(fieldString(decodeMessage(reply), 1)); // "hello"`}
      />

      <H2>Add your own service</H2>

      <P>
        A service is one function: it takes the request message bytes and
        returns the reply message bytes. Field 1 is a string, field 2 is
        a number — that covers most small APIs.
      </P>

      <CodeBlock
        title="A custom service"
        code={`import { createGrpcWebHandler, encodeStringField, decodeMessage, fieldString }
  from "yatta.js/grpcweb";

export const grpcWeb = createGrpcWebHandler({
  // Greets the name sent in field 1.
  "demo.Greeter/Hello": (request) => {
    const name = fieldString(decodeMessage(request), 1) ?? "friend";
    return encodeStringField(1, \`Hello, \${name}\`);
  },
});`}
      />

      <Note kind="warn">
        gRPC-Web here has no login of its own. If a service must stay
        private, check the caller before you run it.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/webdav", title: "WebDAV" }}
        next={{ href: "/docs/protocols/doh", title: "DNS over HTTPS" }}
      />
    </article>
  );
}
