import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
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
        and AAAA records are supported — the normal “what IP is this
        name?” question. Answers come from the machine’s own resolver.
      </P>

      <H2>Try it</H2>

      <P>
        The easy shape is JSON: a name and a type, nothing else.
      </P>

      <CodeBlock
        title="Ask for an address"
        code={`# JSON shape — the easy one
curl "http://localhost:4000/dns-query?name=example.com&type=A"

# From code, with the helper
import { resolveDoH } from "yatta.js/doh";

const answers = await resolveDoH("http://localhost:4000/dns-query", "example.com", "A");
console.log(answers[0].address); // "93.184.215.14"`}
      />

      <P>
        The strict RFC shape also works: POST a DNS wire message with{" "}
        <Code>Content-Type: application/dns-message</Code>, or GET with a
        base64url message in <Code>?dns=...</Code>.
      </P>

      <P>
        Only A and AAAA are answered. A type name the server does not
        know is answered “not supported”, never silently as A. And if
        the resolver hands back a broken address, the reply is a clean
        server failure, not a crash.
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
