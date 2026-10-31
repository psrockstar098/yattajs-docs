import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "DNS over HTTPS — YATTA Docs",
  description:
    "Serve and resolve DNS queries over HTTPS (RFC 8484) on /dns-query.",
};

export default function DohDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "DNS over HTTPS" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="Ask DNS questions over HTTPS instead of plain UDP. Private, and it works anywhere HTTPS works.">
        DNS over HTTPS
      </H1>

      <P>
        Yatta answers DNS questions on <Code>/dns-query</Code>. Only A
        and AAAA records are answered — the normal “what IP is this
        name?” question. Answers come from the machine’s own resolver.
      </P>

      <H2>Ask with JSON</H2>

      <P>
        The easy shape is a GET with a name and a type. Nothing else
        is needed.
      </P>

      <CodeBlock
        title="Ask for an address"
        code={`curl "http://localhost:4000/dns-query?name=example.com&type=A"

# Answer
{
  "Status": 0,
  "TC": false, "RD": true, "RA": true,
  "Question": [{ "name": "example.com.", "type": 1 }],
  "Answer": [{ "name": "example.com.", "type": 1, "TTL": 300, "data": "93.184.215.14" }]
}

# IPv6 instead — type AAAA, code 28
curl "http://localhost:4000/dns-query?name=example.com&type=AAAA"`}
      />

      <H2>Ask from code</H2>

      <P>
        Ask for the JSON shape with an Accept header, then read the
        data field of the first answer.
      </P>

      <CodeBlock
        title="Fetch the JSON shape"
        code={`const res = await fetch(
  "http://localhost:4000/dns-query?name=example.com&type=A",
  { headers: { Accept: "application/dns-json" } },
);
const body = await res.json();
console.log(body.Answer[0].data); // "93.184.215.14"`}
      />

      <H2>Wire format</H2>

      <P>
        The strict RFC shape also works. POST a DNS wire message with{" "}
        <Code>Content-Type: application/dns-message</Code>, or GET with
        a base64url wire message in <Code>?dns=...</Code>. The answer
        comes back as <Code>application/dns-message</Code>.
      </P>

      <CodeBlock
        title="Wire message by POST"
        code={`# query.bin holds one DNS wire message, one question
curl -X POST --data-binary @query.bin \\
  -H "Content-Type: application/dns-message" \\
  http://localhost:4000/dns-query -o answer.bin

# Or the same message, base64url, in a GET
curl "http://localhost:4000/dns-query?dns=AAABAAABAAAAAAAAB2V4YW1wbGUDY29tAAABAAE"`}
      />

      <H2>Answer codes</H2>

      <Props
        items={[
          { name: "Status 0", desc: "Answered. Check the Answer list." },
          { name: "Status 3", desc: "The name does not exist (NXDOMAIN)." },
          { name: "Status 2", desc: "Server failure. Includes a type the server does not support, and a broken address from the resolver." },
          { name: "Wire rcode 4", desc: "NOTIMP on the wire shape, for a type other than A or AAAA. The JSON shape reports the same case as Status 2." },
        ]}
      />

      <P>
        Only A and AAAA are ever answered. A type name the server does
        not know is answered “not supported”, never silently as A.
        And if the resolver hands back a broken address, the reply is
        a clean server failure, not a crash.
      </P>

      <H2>Bad questions</H2>

      <P>
        These answer 400, before any lookup happens: a wire message
        with more than one question, a compression pointer, a
        truncated message, or bad base64 in <Code>?dns=</Code>. A GET
        with neither <Code>?name=</Code> nor <Code>?dns=</Code> also
        answers 400.
      </P>

      <Note kind="warn">
        A public DoH endpoint can be used to map your network. Only
        expose <Code>/dns-query</Code> publicly if you mean to run a
        public resolver.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/grpc-web", title: "gRPC-Web" }}
        next={{ href: "/docs/protocols/webfinger", title: "WebFinger" }}
      />
    </article>
  );
}
