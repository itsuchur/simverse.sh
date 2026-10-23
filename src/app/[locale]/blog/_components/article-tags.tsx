import { articleTags } from "~/lib/article-tags";
import { Link } from "~/i18n/navigation";

export function ArticleTags({ tags }: { tags: unknown }) {
  const names = articleTags(tags);
  if (names.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2 text-xs">
      {names.map((name) => (
        <li key={name}>
          <Link
            href={{ pathname: "/blog", query: { tag: name } }}
            className="bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-ring block rounded-full px-3 py-1 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
