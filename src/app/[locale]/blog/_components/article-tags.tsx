import { articleTags } from "~/lib/article-tags";

export function ArticleTags({ tags }: { tags: unknown }) {
  const names = articleTags(tags);
  if (names.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2 text-xs">
      {names.map((name) => (
        <li
          key={name}
          className="bg-muted text-muted-foreground rounded-full px-3 py-1"
        >
          {name}
        </li>
      ))}
    </ul>
  );
}
