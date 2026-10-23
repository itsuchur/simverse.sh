import { expect, mock, test } from "bun:test";

let matchingRows: { id: number }[] = [];
const whereJsonSupersetOf = mock(async () => matchingRows);
mock.module("@strapi/strapi", () => ({
  factories: {
    createCoreController: (_uid: string, extend: Function) =>
      Object.setPrototypeOf(
        extend({
          strapi: {
            db: {
              connection: () => ({ select: () => ({ whereJsonSupersetOf }) }),
            },
          },
        }),
        { find: (ctx: { query: unknown }) => ctx.query },
      ),
  },
}));
const { default: controller } = await import("./article");

function context(query: Record<string, unknown>) {
  let stored = query;
  return {
    // Strapi's query getter returns a fresh parsed object on each access.
    get query() {
      return structuredClone(stored);
    },
    set query(value) {
      stored = value;
    },
    badRequest: (message: string) => ({ error: message }),
  };
}

test("exact tag filter survives Strapi's query getter and preserves locale and pagination", async () => {
  matchingRows = [{ id: 6 }, { id: 7 }];
  const result = await controller.find(
    context({ tag: "esim", locale: "ru", pagination: { page: 2 } }),
  );
  expect(whereJsonSupersetOf).toHaveBeenLastCalledWith("tags", [
    { name: "esim" },
  ]);
  expect(result).toEqual({
    locale: "ru",
    pagination: { page: 2 },
    filters: { $and: [{}, { id: { $in: [6, 7] } }] },
  });
});

test("a nonexistent tag keeps an explicit filter that cannot match any article", async () => {
  matchingRows = [];
  const result = await controller.find(context({ tag: "missing" }));
  expect(result.filters.$and[1]).toEqual({ id: { $in: [0] } });
});
