import type { ReactNode } from "react";

import { LegalLink } from "./legal-link";
import type { LegalBlock, LegalInline } from "~/lib/legal-document";

function Inline({ tokens }: { tokens: LegalInline[] }) {
  return tokens.map((token, index) => {
    const key = `${token.type}-${index}`;

    switch (token.type) {
      case "strong":
        return (
          <strong key={key} className="font-semibold">
            {token.value}
          </strong>
        );
      case "code":
        return (
          <code
            key={key}
            className="bg-muted rounded px-1 py-0.5 font-mono text-[0.8125rem]"
          >
            {token.value}
          </code>
        );
      case "link":
        return (
          <LegalLink key={key} href={token.href}>
            {token.value}
          </LegalLink>
        );
      default:
        return <span key={key}>{token.value}</span>;
    }
  });
}

function BlockContent({ block }: { block: LegalBlock }) {
  if (block.type === "h2") {
    return (
      <h2 className="text-lg font-medium">
        <Inline tokens={block.children} />
      </h2>
    );
  }

  if (block.type === "h3") {
    return (
      <h3 className="font-medium">
        <Inline tokens={block.children} />
      </h3>
    );
  }

  if (block.type === "p") {
    return (
      <p>
        <Inline tokens={block.children} />
      </p>
    );
  }

  const List = block.type === "ul" ? "ul" : "ol";
  const listClass =
    block.type === "ul"
      ? "list-disc space-y-1 pl-5"
      : "list-decimal space-y-1 pl-5";

  return (
    <List className={listClass}>
      {block.items.map((item, index) => (
        <li key={index}>
          <Inline tokens={item} />
        </li>
      ))}
    </List>
  );
}

export function LegalMarkdown({ blocks }: { blocks: LegalBlock[] }) {
  const content: ReactNode[] = blocks.map((block, index) => (
    <BlockContent key={index} block={block} />
  ));

  return <div className="mt-6 space-y-4 text-sm leading-6">{content}</div>;
}
