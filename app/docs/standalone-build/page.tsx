import type { Metadata } from "next";
import { CodeBlock } from "@/components/docs/code-block";
import { H1, H2, P, Note, Callout, DocFooter, Code, Breadcrumb,
} from "@/components/docs/prose";

export const metadata: Metadata = {
  title: "Standalone binary — YATTA Docs",
  description:
    "Build one executable from your app with yatta build --standalone: code and static assets in, databases and secrets out.",
};

export default function StandaloneBuildDocsPage() {
  return (
    <article className="max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Docs", href: "/docs" },
          { label: "Roadmap" },
          { label: "Standalone binary" },
        ]}
      />
      <H1 eyebrow={'Roadmap'} sub="Deployment today is source-based: install Bun, install dependencies, run the entrypoint. A standalone build gives you the other option — one executable file that runs with nothing installed but itself.">
        Standalone binary
      </H1>

      <H2>Building</H2>

      <CodeBlock
        code={`yatta build --standalone
./dist/app`}
      />

      <P>
        The binary holds the app code, the schema definitions (they are
        code), and the public static assets. It runs on any machine for the
        target platform, with no Bun install and no <Code>node_modules</Code>{" "}
        to copy. A bare <Code>yatta build</Code> without{" "}
        <Code>--standalone</Code> fails — today there is one build mode
        family, and a bare build is treated as a mistake, not a default.
      </P>

      <Callout kind="warn">
        On Bun 1.4.4, a bundled app crashes unless two things are both true:
        the entry file lives <strong>inside</strong> the package directory,
        and the entry imports <code>&quot;reflect-metadata&quot;</code> first,
        before anything else. If your binary crashes on startup with no
        useful error, check those two things first — an entry outside the
        package, or a missing <code>reflect-metadata</code> import, is the
        usual cause. Put the import at the very top of your entry file:
      </Callout>

      <CodeBlock
        title="yatta/main.ts — first line"
        code={`import "reflect-metadata";
// ...every other import follows`}
      />

      <H2>What goes in, what stays out</H2>

      <CodeBlock
        code={`yatta build --standalone --entry yatta/main.ts --out dist/app`}
      />

      <P>
        In: the entrypoint and everything it imports, bundled by{" "}
        <Code>bun build --compile</Code>. Static assets: <Code>./public</Code>{" "}
        is embedded automatically when it exists, and <Code>--asset &lt;dir&gt;</Code>{" "}
        embeds more directories, repeatable. At runtime the files live under{" "}
        <Code>import.meta.dir</Code>, so the app reads them the same way it
        does under <Code>bun run</Code>:
      </P>

      <CodeBlock
        title="Reading an embedded asset"
        code={`import { join } from "node:path";

// Serves public/hello.txt from inside the binary — or from disk
// under bun run, where import.meta.dir is the source directory.
Bun.file(join(import.meta.dir, "public", "hello.txt"));`}
      />

      <P>
        Frontend code, when the entrypoint imports an HTML file: Bun bundles
        the page&apos;s scripts and assets into the same executable, so a
        full-stack app ships as one unit with no extra flag. That is
        Bun&apos;s native HTML-import behaviour, not a Yatta step.
      </P>

      <P>
        Out, by design: SQLite database files, uploads and storage
        directories, and <Code>.env</Code> files and secrets. A compiled
        binary resolves a database path relative to the working directory,
        not to the binary, so the data lives beside it: run the binary from
        the directory that holds <Code>data/app.db</Code>, and point{" "}
        <Code>DATABASE_URL</Code> there. The build never reads the
        project&apos;s <Code>.env</Code>, and nothing from it is baked in. A
        compiled binary still loads a <Code>.env</Code> file from the
        directory it runs in — that is the config mechanism, not a leak.
      </P>

      <CodeBlock
        title="On the server"
        code={`./dist/app            # the app
./data/app.db         # the database, created on first run
./.env                # read at runtime, never baked in`}
      />

      <H2>Two modes: JIT bundle and AOT</H2>

      <P>
        The default bundles the JavaScript and runs it with the JIT. It is
        the stable mode, and the only one that cross-compiles:
      </P>

      <CodeBlock
        code={`yatta build --standalone --no-aot`}
      />

      <P>
        <Code>--aot</Code> compiles to machine code at build time instead:
      </P>

      <CodeBlock
        code={`yatta build --standalone --aot`}
      />

      <P>
        What changes on a Bun that fully supports it: faster startup, less
        memory (no bytecode, no JIT, no profiling data), and typed code runs
        faster because a property access becomes a load from a fixed offset.
        What it costs: the build takes longer, it builds only for the machine
        it runs on (build in CI or a container per platform — a foreign{" "}
        <Code>--target</Code> with <Code>--aot</Code> is refused), built-in
        objects become read-only, code from a string runs interpreted, and
        untyped hot code can run slower than under the JIT, because the JIT
        learns from real traffic and the compiler has to prove everything up
        front.
      </P>

      <Callout>
        Measured on Bun 1.4.4: there is no standalone <code>bun compile</code>{" "}
        command — only the <code>bun build --compile</code> form, which is
        what this command uses. <code>bun build --compile --aot</code> is
        accepted there, and the resulting binary builds, runs, and serves —
        but whether it changes codegen on 1.4.4 is unverified, because that
        Bun&apos;s <code>bun build</code> silently ignores flags it does not
        know and no <code>--explain</code> output exists to confirm anything.
        So on 1.4.4 the AOT speed and memory wins are not claimed: the mode
        is offered, the binary is verified end to end, and the benefit needs
        a newer Bun to measure. The same holds for <code>--trim</code>: it
        passes through, and its size effect is unverified on 1.4.4.
      </Callout>

      <P>
        So do not pick on principle. Build the same entrypoint both ways and
        measure under load that does what production does. Run the load twice
        and keep the second result, so the JIT has warmed up. If the hot code
        is untyped JavaScript from npm, or peak throughput matters most, the
        JIT bundle usually wins; if startup time and memory matter most, AOT
        usually wins.
      </P>

      <P>
        <Code>--explain</Code> (with <Code>--aot</Code>) lists the code that
        compiled to a slow path, worst first, with a fix for each — the tool
        for keeping hot paths well-typed. It is not available on Bun 1.4.4,
        where it just bundles normally with no report, so asking for it there
        fails with an upgrade pointer rather than pretending a report was
        made:
      </P>

      <CodeBlock
        code={`yatta build --standalone --aot --explain`}
      />

      <P>
        <Code>--trim</Code> drops the Bun and Node APIs the code never calls,
        for a smaller binary. It is experimental, and it does not turn on the
        string-to-code ban by itself (see below).
      </P>

      <P>
        AOT and the type gate: AOT relies on types, so it type-checks the
        whole program first. On a Bun that has it,{" "}
        <Code>yatta build --standalone --aot</Code> runs{" "}
        <Code>bun check --aot</Code> on the entrypoint before compiling. On
        Bun 1.4.4 that flag does not exist, so the gate falls back to plain{" "}
        <Code>bun check</Code> plus a successful{" "}
        <Code>bun build --compile</Code> — and the fallback is printed in the
        build output, not hidden. Either way, a type error stops the build
        with no binary written. For JIT builds the same gate is opt-in:
      </P>

      <CodeBlock
        code={`yatta build --standalone --check`}
      />

      <P>
        Two frictions, both from Bun&apos;s own docs. First, TypeScript 7
        defaults changed: <Code>strict</Code> is on, and <Code>types</Code> is
        empty unless the project lists it — a project that relied on ambient{" "}
        <Code>@types/bun</Code> without listing it fails the gate until{" "}
        <Code>tsconfig.json</Code> says <Code>&quot;types&quot;: [&quot;bun&quot;]</Code>.
        Second, if <Code>package.json</Code> has a <Code>check</Code> script,
        bare <Code>bun check</Code> runs that script instead of the
        typechecker; the gate passes <Code>--no-script</Code> so it always
        gets the checker.
      </P>

      <H2>Cross-compile</H2>

      <CodeBlock
        code={`yatta build --standalone --target bun-linux-x64
yatta build --standalone --target bun-darwin-arm64`}
      />

      <P>
        Targets are the ones Bun documents: <Code>bun-linux-x64</Code>,{" "}
        <Code>bun-linux-x64-musl</Code>, <Code>bun-linux-arm64</Code>,{" "}
        <Code>bun-linux-arm64-musl</Code>, <Code>bun-windows-x64</Code>,{" "}
        <Code>bun-windows-arm64</Code>, <Code>bun-darwin-x64</Code>,{" "}
        <Code>bun-darwin-arm64</Code>. Anything else is refused with the list,
        rather than passed to Bun to fail obscurely. Cross-compiling needs the
        JIT mode: <Code>--aot</Code> with a foreign target is refused, because
        AOT only builds for the machine it runs on.
      </P>

      <H2>Build config file</H2>

      <P>
        Flags are enough for one-off builds. For a repeatable build, put the
        options in a file and point at it. CLI flags win over config values.
        Unknown keys are refused, not ignored: a misspelled key that quietly
        did nothing would be a build the caller did not actually request.
      </P>

      <CodeBlock
        code={`yatta build --standalone --config yatta.build.json5`}
      />

      <CodeBlock
        title="yatta.build.json5"
        code={`{
  // Comments and trailing commas are fine: this is JSON5, parsed
  // by the CLI at build time. The file is never embedded.
  entry: "yatta/main.ts",
  out: "dist/app",
  target: "bun-linux-x64",
  assets: ["public"],
  minify: true,
}`}
      />

      <P>
        Config keys use camelCase where the flags use kebab-case:{" "}
        <Code>noAddons</Code>, <Code>noFfiCc</Code>,{" "}
        <Code>disallowCodeGeneration</Code> for{" "}
        <Code>--no-addons</Code>, <Code>--no-ffi-cc</Code>, and{" "}
        <Code>--disallow-code-generation</Code>. The full key list is{" "}
        <Code>entry</Code>, <Code>out</Code>, <Code>target</Code>,{" "}
        <Code>assets</Code>, <Code>minify</Code>, <Code>aot</Code>,{" "}
        <Code>trim</Code>, <Code>smol</Code>, <Code>noAddons</Code>,{" "}
        <Code>noFfiCc</Code>, <Code>disallowCodeGeneration</Code>,{" "}
        <Code>explain</Code>, <Code>check</Code>.
      </P>

      <H2>Hardening: bake runtime flags into the binary</H2>

      <P>
        Runtime flags can be baked in at build time, so the binary runs with
        them every time, with no arguments:
      </P>

      <CodeBlock
        code={`# Less memory at a performance cost (GC runs more often). An
# explicit knob for a small box — never a default.
yatta build --standalone --smol

# Refuse native addons, and refuse bun:ffi's C compiler.
yatta build --standalone --no-addons
yatta build --standalone --no-ffi-cc`}
      />

      <P>
        The string-to-code ban is the one that changes what code can do:
      </P>

      <CodeBlock
        code={`yatta build --standalone --disallow-code-generation
yatta build --standalone --disallow-code-generation=strict`}
      />

      <P>
        With the ban baked in, <Code>eval()</Code> and{" "}
        <Code>new Function()</Code> throw a synchronous <Code>EvalError</Code>{" "}
        for the whole process, and <Code>BUN_OPTIONS</Code> can raise the level
        but never lower it. The <Code>=strict</Code> level bans every
        string-to-code path — <Code>node:vm</Code>, data-URL imports, workers
        started from a string, macros — and a strict binary loads code from
        the executable only, never from disk. Write the level with{" "}
        <Code>=</Code>: a space-separated <Code>strict</Code> becomes a stray
        argument the binary ignores, and the build writes it with{" "}
        <Code>=</Code> for that reason.
      </P>

      <P>
        Compatibility check: if the entrypoint itself generates code with{" "}
        <Code>eval(</Code> or <Code>new Function(</Code>, the build refuses
        the combination instead of shipping a binary that throws at runtime.
        The check covers the entrypoint only, on purpose — a naive scan over
        every dependency would refuse builds for a match inside a comment or
        a string. So a dependency that generates code (some validators and
        serializers do) still breaks under the ban at runtime, which is why
        the ban stays opt-in. If you turn it on, run the app&apos;s suite
        against the hardened binary before shipping it.
      </P>

      <H2>The build refuses data-looking assets</H2>

      <P>
        Only imported files and <Code>--asset</Code> directories are embedded
        — a file that merely sits next to the entrypoint is not. On top of
        that, the build checks every asset path before compiling, and refuses
        the whole build instead of silently dropping a file:
      </P>

      <CodeBlock
        code={`yatta build --standalone --asset uploads
# Refusing --asset "uploads": directory "uploads" holds data, not static assets.`}
      />

      <P>
        Refused: <Code>.env</Code> files (including <Code>.env.local</Code>{" "}
        and friends), database files (<Code>.db</Code>, <Code>.sqlite</Code>,{" "}
        <Code>.sqlite3</Code>), key material (<Code>.pem</Code>,{" "}
        <Code>.key</Code>, <Code>id_rsa*</Code>), and directories named{" "}
        <Code>uploads</Code>, <Code>storage</Code>, or <Code>Database</Code> —
        including a data file hiding inside an otherwise innocent asset
        directory.
      </P>

      <H2>Gotchas</H2>

      <P>
        <strong>No <Code>--sourcemap</Code>.</strong> An embedded sourcemap
        carries the build machine&apos;s paths into the binary, so the build
        does not pass the flag. If you need stack traces to map back, keep the
        build machine&apos;s source tree, not a sourcemap in the artifact.
      </P>

      <P>
        <strong>Old Bun, new flags.</strong> Bun&apos;s{" "}
        <Code>bun build</Code> silently ignores flags it does not know.{" "}
        <Code>--aot</Code> and <Code>--trim</Code> pass through anyway (they
        are accepted on 1.4.4, and the binary is verified to build and run),
        with the honest caveat that their effect is unverified there.{" "}
        <Code>--explain</Code> is the exception: its whole value is the
        report, so on a Bun that produces none it fails with an upgrade
        pointer rather than pretending a report was made.
      </P>

      <P>
        <strong>Worker entrypoints are not auto-detected.</strong> Bun
        compiles the entrypoints it is given; a worker spawned from a URL
        string at runtime is not an import, so it is not bundled. A
        single-entrypoint app — one <Code>Bun.serve</Code> entry that does its
        own work — compiles and runs as-is. An app that leans on the
        framework&apos;s multi-worker runtime pools needs its worker files
        handled before this build covers it; that is a known gap, not a
        silent fallback.
      </P>

      <P>
        <strong>Do not import a database with an embed attribute.</strong>{" "}
        Bun can embed a SQLite file if the import asks for it — this build
        never does, and your app must not either. If a database file is
        inside the binary, it starts in memory and every write is lost when
        the process exits. Data lives outside, always.
      </P>

      <P>
        <strong>The binary is large</strong> — it embeds the Bun runtime.
        Expect roughly a hundred megabytes for a small app, before{" "}
        <Code>--minify</Code> or <Code>--trim</Code>.
      </P>

      <Note>
        <code className="font-mono text-[13px]">--expose-gc</code> exists as a
        debugging aid (it exposes <code className="font-mono text-[13px]">gc()</code>{" "}
        on the global object); it is not a build flag here and not something a
        production binary needs.
      </Note>

      <DocFooter
        prev={{ href: "/docs/time-series", title: "Time series" }}
        next={{ href: "/docs/cloud-backups", title: "Cloud backups" }}
      />
    </article>
  );
}
