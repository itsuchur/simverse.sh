/** TagsInput emits a JSON string of { name } objects; Strapi may decode it. */
export function articleTags(value: unknown): string[] {
  let tags: unknown = value;
  if (typeof tags === "string") {
    try {
      tags = JSON.parse(tags) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(tags)) return [];

  return [
    ...new Set(
      tags.flatMap((tag: unknown) => {
        const name =
          typeof tag === "string"
            ? tag
            : tag && typeof tag === "object" && "name" in tag
              ? tag.name
              : null;
        return typeof name === "string" && name.trim() ? [name.trim()] : [];
      }),
    ),
  ];
}
