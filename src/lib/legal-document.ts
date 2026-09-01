import { readFile } from "node:fs/promises";
import path from "node:path";

import { routing } from "~/i18n/routing";

const LEGAL_FILES = {
  tos: "TOS.md",
  privacy: "PRIVACY-POLICY.md",
  refunds: "REFUNDS.md",
} as const;

function resolveLegalFilename(id: LegalDocumentId, locale: string): string {
  const english = LEGAL_FILES[id];
  if (locale === "ru" && routing.locales.includes("ru")) {
    return english.replace(/\.md$/, ".ru.md");
  }
  return english;
}

export type LegalDocumentId = keyof typeof LEGAL_FILES;

export type LegalInline =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; href: string; value: string };

export type LegalBlock =
  | { type: "h2"; children: LegalInline[] }
  | { type: "h3"; children: LegalInline[] }
  | { type: "p"; children: LegalInline[] }
  | { type: "ul"; items: LegalInline[][] }
  | { type: "ol"; items: LegalInline[][] };

export async function readLegalMarkdown(
  id: LegalDocumentId,
  locale: string,
) {
  const englishFilename = LEGAL_FILES[id];
  const localizedFilename = resolveLegalFilename(id, locale);
  const filePath = (filename: string) =>
    path.join(process.cwd(), filename);

  let markdown: string;
  try {
    markdown = await readFile(filePath(localizedFilename), "utf8");
  } catch {
    markdown = await readFile(filePath(englishFilename), "utf8");
  }

  return parseLegalMarkdown(
    markdown
      .replace(/^# .+\n+/, "")
      .replace(/^\*\*(Last updated|Обновлено):[^*]+\*\*\n+/, "")
      .trim(),
  );
}

export function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const lines = markdown.split("\n");
  const blocks: LegalBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "p", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({
      type: list.type,
      items: list.items.map((item) => parseInline(item)),
    });
    list = null;
  };

  for (const line of lines) {
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{2,3}) (.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: heading[1] === "##" ? "h2" : "h3",
        children: parseInline(heading[2] ?? ""),
      });
      continue;
    }

    const unordered = /^- (.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      if (list?.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1] ?? "");
      continue;
    }

    const ordered = /^\d+\. (.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      if (list?.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1] ?? "");
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return blocks;
}

function parseInline(input: string): LegalInline[] {
  const tokens: LegalInline[] = [];
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let lastIndex = 0;

  for (const match of input.matchAll(pattern)) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: input.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "strong", value: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "code", value: match[2] });
    } else {
      tokens.push({
        type: "link",
        value: match[3] ?? "",
        href: match[4] ?? "",
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < input.length) {
    tokens.push({ type: "text", value: input.slice(lastIndex) });
  }

  return tokens;
}
