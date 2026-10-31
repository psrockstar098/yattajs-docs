import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
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
        same protobuf messages, sent over a normal HTTP POST. Yatta
        serves it on <Code>/grpc-web/&lt;Service&gt;/&lt;Method&gt;</Code>.
        Only single-request, single-reply calls work — no streaming.
      </P>

      <H2>Call Echo</H2>

      <P>
        The built-in Echo service sends your message straight back.
        This example needs no library: it builds the frame by hand.
      </P>

      <CodeBlock
        title="Call Echo with plain fetch"
        code={`// A message frame: 1 flag byte, 4 length bytes (big-endian), then the message.
function frame(message) {
  const out = new Uint8Array(5 + message.length);
  out[0] = 0;
  out[1] = (message.length >> 24) & 0xff;
  out[2] = (message.length >> 16) & 0xff;
  out[3] = (message.length >> 8) & 0xff;
  out[4] = message.length & 0xff;
  out.set(message, 5);
  return out;
}

// A string in field 1: tag 0x0a, length, then the UTF-8 bytes.
function stringField(text) {
  const bytes = new TextEncoder().encode(text);
  const out = new Uint8Array(2 + bytes.length);
  out[0] = 0x0a;
  out[1] = bytes.length;
  out.set(bytes, 2);
  return out;
}

const res = await fetch("http://localhost:4000/grpc-web/yatta.Echo/Echo", {
  method: "POST",
  headers: { "Content-Type": "application/grpc-web" },
  body: frame(stringField("hello")),
});

const buf = new Uint8Array(await res.arrayBuffer());
const len = buf[6]; // reply message, field 1
console.log(new TextDecoder().decode(buf.slice(7, 7 + len))); // "hello"
console.log(res.headers.get("grpc-status")); // "0"`}
      />

      <H2>Check health</H2>

      <P>
        The Health service ignores what you send and answers{" "}
        <Code>SERVING</Code> in field 1. An empty message frame is
        enough.
      </P>

      <CodeBlock
        title="Health check"
        code={`const res = await fetch("http://localhost:4000/grpc-web/yatta.Health/Check", {
  method: "POST",
  headers: { "Content-Type": "application/grpc-web" },
  body: frame(new Uint8Array(0)),
});

const buf = new Uint8Array(await res.arrayBuffer());
const len = buf[6];
console.log(new TextDecoder().decode(buf.slice(7, 7 + len))); // "SERVING"`}
      />

      <H2>Services on the shipped server</H2>

      <Props
        items={[
          { name: "yatta.Echo/Echo", desc: "Send a string in field 1, get the same string back in field 1." },
          { name: "yatta.Health/Check", desc: "Request is ignored. Answers SERVING in field 1." },
        ]}
      />

      <P>
        Only POST works. Any other method, or a path that is not{" "}
        <Code>/grpc-web/&lt;Service&gt;/&lt;Method&gt;</Code>, answers 404.
      </P>

      <H2>The frame format</H2>

      <P>
        Every message travels in a frame. The reply is a message frame
        followed by a trailer frame that carries the status.
      </P>

      <CodeBlock
        title="Frame layout"
        code={`message frame:
  byte 0:     compression flag, always 0
  bytes 1-4:  message length, big-endian
  bytes 5+:   the protobuf message

trailer frame:
  same shape, flag byte set, carrying grpc-status

string field (field 1):
  0x0a, length, UTF-8 bytes

number field (field 2):
  tag byte (field number shifted left 3), then the varint value`}
      />

      <H2>Errors</H2>

      <P>
        Errors still answer HTTP 200. The real code is in the{" "}
        <Code>grpc-status</Code> header and the trailer frame.
      </P>

      <Props
        items={[
          { name: "12", desc: "Unknown service. The Service/Method pair is not served." },
          { name: "3", desc: "Bad frame, or no message frame in the body." },
          { name: "13", desc: "The service itself failed." },
        ]}
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
