import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, H3, P, Note, Callout, Props, DocFooter, Code, Breadcrumb,
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
        <Code>/.well-known/webfinger</Code> and get a small JSON
        document back with the user’s profile link.
      </P>

      <H2>Look up a user</H2>

      <P>
        The lookup key is the full address, not just the name before
        the @. Only users who exist in Yatta’s auth store get an
        answer.
      </P>

      <CodeBlock
        title="Look up a user"
        code={`curl "http://localhost:4000/.well-known/webfinger?resource=acct:ada@example.com"

# Answer — Content-Type: application/jrd+json
{
  "subject": "acct:ada@example.com",
  "links": [
    {
      "rel": "http://webfinger.net/rel/profile-page",
      "type": "text/html",
      "href": "http://localhost:4000"
    },
    {
      "rel": "self",
      "type": "application/jrd+json",
      "href": "http://localhost:4000/.well-known/webfinger?resource=acct:ada@example.com"
    }
  ]
}`}
      />

      <H2>Filter links</H2>

      <P>
        Add <Code>?rel=...</Code> to keep only links with that
        relation. You can repeat it for more than one.
      </P>

      <CodeBlock
        title="Only the self link"
        code={`curl "http://localhost:4000/.well-known/webfinger?resource=acct:ada@example.com&rel=self"

# Answer — only the matching link survives
{
  "subject": "acct:ada@example.com",
  "links": [
    {
      "rel": "self",
      "type": "application/jrd+json",
      "href": "http://localhost:4000/.well-known/webfinger?resource=acct:ada@example.com"
    }
  ]
}`}
      />

      <H2>Errors</H2>

      <Props
        items={[
          { name: "400", desc: "No ?resource= parameter." },
          { name: "404", desc: "Unknown account, or a resource that is not an acct: address." },
        ]}
      />

      <H2>Where the answer comes from</H2>

      <P>
        The profile link points at the app itself. Its base URL comes
        from the <Code>APP_URL</Code> environment variable, or{" "}
        <Code>http://localhost:4000</Code> when that is not set.
      </P>

      <Note kind="warn">
        WebFinger reveals which email addresses have an account: 200
        means yes, 404 means no. That is how a discovery protocol
        works — only expose it publicly if that is fine for your app.
      </Note>

      <DocFooter
        prev={{ href: "/docs/protocols/doh", title: "DNS over HTTPS" }}
        next={{ href: "/docs/protocols/oauth-server", title: "OAuth 2.0 server" }}
      />
    </article>
  );
}
