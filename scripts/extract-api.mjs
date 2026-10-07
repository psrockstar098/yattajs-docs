// scripts/extract-api.mjs
//
// Walks the Yatta framework with the TypeScript compiler API and emits a
// complete, accurate description of the public API surface.
//
// This exists because hand-written docs drift: writing signatures from memory
// produces code that looks right and does not compile. Everything below is read
// straight out of the source AST, so the reference cannot invent a symbol.
//
// Output: lib/api-surface.json  (consumed by app/docs/api-reference/*)

import ts from "typescript";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? "/home/psrockstar/Documents/code/Yatta");
const OUT = resolve(process.argv[3] ?? "lib/api-surface.json");

/** module specifier -> source file, mirroring package.json "exports". */
const MODULES = [
  { id: "yatta", label: "yatta", file: "src/main.ts" },
  { id: "yatta/runtime", label: "yatta/runtime", file: "core_runtime/index.ts" },
  { id: "yatta/api", label: "yatta/api", file: "src/types/index.ts" },
  { id: "yatta/observe", label: "yatta/observe", file: "src/types/observe.ts" },
  { id: "yatta/otel", label: "yatta/otel", file: "src/types/otel.ts" },
  { id: "yatta/db", label: "yatta/db", file: "src/types/db.ts" },
  { id: "yatta/auth", label: "yatta/auth", file: "src/types/auth.ts" },
  { id: "yatta/jobs", label: "yatta/jobs", file: "src/types/job.ts" },
  { id: "yatta/cache", label: "yatta/cache", file: "src/types/cache_queue.ts" },
  { id: "yatta/storage", label: "yatta/storage", file: "src/types/storage.ts" },
  { id: "yatta/mail", label: "yatta/mail", file: "src/types/mail.ts" },
  { id: "yatta/realtime", label: "yatta/realtime", file: "src/types/realtime.ts" },
];

/**
 * Clean a type node down to a readable one-line signature.
 *
 * The printer collapses newlines and comments, which is what keeps a long
 * `AuthConfig & { store: … }` intersection on one line instead of expanding
 * across twenty.
 */
function typeText(node) {
  if (!node) return "";
  const printer = ts.createPrinter({
    removeComments: true,
    newLine: ts.NewLineKind.None,
  });
  return printer
    .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
    .replace(/\s+/g, " ")
    .trim();
}

function paramText(node) {
  if (!node.parameters || node.parameters.length === 0) return "";
  return node.parameters
    .map((p) => {
      const optional = p.questionToken || p.initializer ? "?" : "";
      // Rest parameters need their spread, or `...handlers` reads as a
      // single ordinary argument named "handlers".
      const rest = p.dotDotDotToken ? "..." : "";
      return `${rest}${p.name.getText()}${optional}: ${typeText(p.type)}`;
    })
    .join(", ");
}

/** Read the comment body off a JSDoc node, whatever shape TS gives us. */
function commentText(comment) {
  if (comment == null) return "";
  if (typeof comment === "string") return comment;
  return comment
    .map((part) => (typeof part === "string" ? part : part.text ?? ""))
    .join("");
}

/**
 * Flatten JSDoc into a summary plus @param / @returns notes.
 *
 * Read straight off the AST's `jsDoc` nodes rather than through the checker:
 * `checker.getDocumentationComment` is internal and not present in the public
 * TypeScript API surface.
 */
function jsdoc(node) {
  const docs = (node.jsDoc ?? []).filter(Boolean);

  const summary = docs
    .map((d) => commentText(d.comment))
    .join("\n\n")
    .replace(/\r/g, "")
    .trim();

  const params = [];
  let returns = "";
  const examples = [];

  for (const doc of docs) {
    for (const tag of doc.tags ?? []) {
      const name = tag.tagName?.text ?? "";
      const text = commentText(tag.comment).replace(/\r/g, "").trim();

      if (name === "example") {
        // Examples live in @example tags, not the comment body — scanning
        // only the body drops almost all of them.
        if (text) examples.push(text);
      } else if (name === "param" || name === "arg") {
        // TypeScript parses the identifier out of `@param` for us and leaves
        // only the description in `tag.comment` — taking the first word of the
        // comment would report "Master" as the parameter name. Read
        // `tag.name` when the parser supplied one, and fall back to the
        // textual form only for tags it could not split.
        const parsed = tag.name?.getText?.();
        if (parsed) {
          params.push({ name: parsed, text });
        } else {
          const m = text.match(/^(?:\{[^}]*\}\s*)?(\S+)\s*(?:-\s*)?([\s\S]*)$/);
          if (m) params.push({ name: m[1].replace(/^-/, ""), text: m[2] || "" });
        }
      } else if (name === "returns" || name === "return") {
        returns = text;
      }
    }
  }

  // Split a multi-paragraph summary: first paragraph is the blurb, the rest
  // becomes a note shown under the signature.
  const paras = summary.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const note = paras.slice(1).join("\n\n");

  // A "paragraph" is often a single wrapped line rather than a blank-line
  // separated block, so also cut at the first hard newline. Otherwise the
  // blurb under a heading runs on for two sentences and looks like a bug.
  const blurb = (paras[0] ?? "").split("\n")[0].trim();

  // Prefer an @example tag; fall back to a fence in the comment body.
  const example =
    examples.map(extractExample).find(Boolean) ?? extractExample(summary);

  return {
    summary: blurb,
    note,
    example,
    examples: examples.map(extractExample).filter(Boolean),
    params,
    returns,
  };
}

/** Pull the fenced code block out of a JSDoc fragment, stripping the fence. */
function extractExample(text) {
  const m = text.match(/```[a-zA-Z0-9]*\r?\n?([\s\S]*?)```/);
  if (!m) return "";
  // An @example tag may be plain prose with no fence at all.
  return m[1].trim() || text.trim();
}

/** Walk a class/interface body, collecting members worth documenting. */
function membersOf(node) {
  const out = [];

  for (const m of node.members) {
    if (!ts.isMethodSignature(m) && !ts.isMethodDeclaration(m)) {
      if (
        ts.isPropertySignature(m) ||
        ts.isPropertyDeclaration(m) ||
        ts.isGetAccessor(m) ||
        ts.isSetAccessor(m)
      ) {
        // Record properties too — config objects are mostly properties.
        const name = m.name?.getText?.();
        if (name && !name.startsWith("_")) {
          const d = jsdoc(m);
          out.push({
            name,
            kind: m.kind === ts.SyntaxKind.GetAccessor
              ? "getter"
              : m.kind === ts.SyntaxKind.SetAccessor
              ? "setter"
              : "property",
            signature: `${name}${m.questionToken ? "?" : ""}: ${typeText(m.type)}`,
            ...d,
          });
        }
      }
      continue;
    }

    const name = m.name?.getText?.();
    if (!name || name.startsWith("_")) continue;

    const optional = m.questionToken ? "?" : "";
    const generics = m.typeParameters?.length
      ? `<${m.typeParameters.map((t) => t.getText()).join(", ")}>`
      : "";
    const sig = `${name}${generics}(${paramText(m)})${
      m.type ? `: ${typeText(m.type)}` : ""
    }`;

    const d = jsdoc(m);

    // Mark the handful of members that are the headline capability of a
    // subsystem, so the reference page can lead with them.
    const HEADLINE = /^(get|set|on|emit|add|enqueue|send|put|get|create|sign|list|delete|update|insert|select|query|run|exec|subscribe|publish|broadcast|join|leave|namespace|to|room|channel|waitFor|pipe|pipeJob|cron|schedule|define|register|mount|start|stop|drain|health|ready|use|login|logout|sign|verify|hash|middleware|use)$/;

    out.push({
      name,
      kind: "method",
      signature: sig + optional,
      headline: HEADLINE.test(name),
      ...d,
    });
  }

  // Interface call signatures: iterables, thenables, and the like.
  for (const m of node.members) {
    if (!ts.isCallSignatureDeclaration(m)) continue;
    const d = jsdoc(m);
    out.push({
      name: "[call]",
      kind: "call",
      signature: `(${paramText(m)})${m.type ? `: ${typeText(m.type)}` : ""}`,
      ...d,
    });
  }

  return out;
}

function exportedName(node) {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) ?? [] : [];
  const isExport = modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  const isDefault = modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
  return isExport && !isDefault;
}

const program = ts.createProgram(
  MODULES.map((m) => resolve(ROOT, m.file)),
  {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    strict: false,
    skipLibCheck: true,
    noEmit: true,
  },
);

const checker = program.getTypeChecker();
const surface = {};

for (const mod of MODULES) {
  const sf = program.getSourceFile(resolve(ROOT, mod.file));
  if (!sf) {
    console.error(`!! could not load ${mod.file}`);
    continue;
  }

  const symbols = [];

  for (const node of sf.statements) {
    // ── export ... from "..."  →  follow the re-export to its definition ──
    if (ts.isExportDeclaration(node) && node.exportClause) {
      if (ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          const alias = el.name.getText();
          const target = el.propertyName?.getText();
          const sym = target
            ? checker.getAliasedSymbol(
                (() => {
                  const s = checker.getSymbolAtLocation(el.name);
                  return s;
                })(),
              )
            : checker.getSymbolAtLocation(el.name);
          const decl = sym?.declarations?.[0];
          if (decl) symbols.push({ name: alias, decl });
        }
      }
      continue;
    }

    if (!exportedName(node)) continue;

    if (
      ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isVariableStatement(node)
    ) {
      symbols.push({ name: node.name?.getText(), decl: node });
    }
  }

  const entries = [];

  for (const { name, decl } of symbols) {
    if (!name) continue;
    const d = jsdoc(decl);
    const mods = ts.canHaveModifiers(decl) ? ts.getModifiers(decl) ?? [] : [];
    const tags = mods.map((m) => m.getText());

    let kind = "unknown";
    let signature = name;
    let members = [];
    let typeParams = "";

    if (ts.isFunctionDeclaration(decl)) {
      kind = tags.includes("async") ? "async function" : "function";
      typeParams = decl.typeParameters?.length
        ? `<${decl.typeParameters.map((t) => t.getText()).join(", ")}>`
        : "";
      signature = `${name}${typeParams}(${paramText(decl)})`;
      if (decl.type) signature += `: ${typeText(decl.type)}`;
    } else if (ts.isClassDeclaration(decl)) {
      kind = "class";
      signature = `class ${name}${
        decl.heritageClauses?.length
          ? " " +
            decl.heritageClauses
              .map((h) => {
                // heritageClause.token is a SyntaxKind, not a node.
                const keyword = ts.tokenToString(h.token) ?? "";
                return `${keyword} ${h.types.map((t) => t.getText()).join(", ")}`;
              })
              .join(" ")
          : ""
      }`;
      members = membersOf(decl);
    } else if (ts.isInterfaceDeclaration(decl)) {
      kind = "interface";
      typeParams = decl.typeParameters?.length
        ? `<${decl.typeParameters.map((t) => t.getText()).join(", ")}>`
        : "";
      signature = `interface ${name}${typeParams}`;
      members = membersOf(decl);
    } else if (ts.isTypeAliasDeclaration(decl)) {
      kind = "type";
      signature = `type ${name}${
        decl.typeParameters?.length
          ? `<${decl.typeParameters.map((t) => t.getText()).join(", ")}>`
          : ""
      } = ${typeText(decl.type)}`;
    } else if (ts.isEnumDeclaration(decl)) {
      kind = "enum";
      signature = `enum ${name}`;
      members = decl.members.map((m) => {
        const mn = m.name.getText();
        return {
          name: mn,
          kind: "member",
          signature: `${mn} = ${m.initializer ? m.initializer.getText() : "…"}`,
          summary: "",
          note: "",
          example: "",
          params: [],
          returns: "",
        };
      });
    } else if (ts.isVariableStatement(decl)) {
      kind = "const";
      const decl2 = decl.declarationList.declarations[0];
      signature = `const ${name}${decl2.type ? `: ${typeText(decl2.type)}` : ""}`;
    }

    entries.push({ name, kind, signature, ...d, members });
  }

  entries.sort((a, b) => {
    const rank = {
      function: 0, "async function": 0, class: 1, interface: 2,
      type: 3, enum: 4, const: 5, unknown: 6,
    };
    const d = (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9);
    return d !== 0 ? d : a.name.localeCompare(b.name);
  });

  // Collapse TypeScript overloads. `createAPI` is declared three times with
  // widening generics; to a reader that is one function, not three.
  const byKey = new Map();
  const merged = [];

  for (const e of entries) {
    const key = `${e.kind === "async function" ? "function" : e.kind}:${e.name}`;
    const prev = byKey.get(key);

    if (!prev) {
      byKey.set(key, e);
      merged.push(e);
      continue;
    }

    // Keep the overload whose parameters carry the most type information —
    // that is the one a reader learns from.
    if (e.signature.length > prev.signature.length) {
      prev.signature = e.signature;
      prev.signatureAll = undefined;
    }
    prev.overloads = [...(prev.overloads ?? []), e.signature];
    // Any overload that documents something is worth surfacing.
    if (!prev.example && e.example) prev.example = e.example;
    if (!prev.summary && e.summary) prev.summary = e.summary;
  }

  surface[mod.id] = { label: mod.label, file: mod.file, entries: merged };
}

// ── report ────────────────────────────────────────────────────────────────
let totalSymbols = 0;
let totalMembers = 0;

for (const [id, mod] of Object.entries(surface)) {
  const m = mod.entries.reduce((n, e) => n + e.members.length, 0);
  totalSymbols += mod.entries.length;
  totalMembers += m;
  console.log(
    `${id.padEnd(18)} ${String(mod.entries.length).padStart(3)} symbols  ${String(m).padStart(4)} members`,
  );
}

console.log(
  `\n${totalSymbols} top-level symbols, ${totalMembers} documented members`,
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(surface, null, 1));
console.log(`wrote ${OUT}`);
