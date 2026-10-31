import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "WebFinger — YATTA Docs",
  description:
    "Resource discovery (RFC 7033): acct: lookups with JRD responses.",
};

export default function WebFingerDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Protocols" },
          { label: "WebFinger" },
        ]}
      />
      <H1 eyebrow={'Protocols'} sub="Let other servers find your users. One URL, one small JSON answer.">
        WebFinger
      </H1>

      <P>
        WebFinger answers one question: “who is this account?” Other
        servers — for example fediverse software — ask Yatta at{" "}
        <Code>/.well-known/webfinger</Code> and get a small JSON document
        back with the user’s profile link.
      </P>

      <H2>Try it</H2>

      <CodeBlock
        title="Look up a user"
        code={`curl "http://localhost:4000/.well-known/webfinger?resource=acct:ada@example.com"

# Answer (shortened)
{
  "subject": "acct:ada@example.com",
  "links": [
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "http://localhost:4000"
    }
  ]
}`}
      />

      <P>
        Only users who exist in Yatta’s auth store get an answer.
        Unknown accounts get a 404. The lookup uses the full address
        (<Code>acct:ada@example.com</Code>), not just the name before
        the @. Add{" "}
        <Code>?rel=self</Code> to keep only links with that relation.
      </P>

      <Note kind="warn">
        WebFinger reveals which email addresses have an account. Only
        expose it publicly if that is fine for your app.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/doh", title: "DNS over HTTPS" }}
        next={{ href: "/docs/protocols/oauth-server", title: "OAuth 2.0 server" }}
      />
    </article>
  );
}
