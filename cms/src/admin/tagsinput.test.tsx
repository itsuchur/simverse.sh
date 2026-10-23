import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost" });
for (const key of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLInputElement",
  "Node",
  "MutationObserver",
  "localStorage",
  "getComputedStyle",
]) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: key === "window" ? window : (window as any)[key],
  });
}

const React = await import("react");
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { IntlProvider } = await import("react-intl");
const { DesignSystemProvider } = await import("@strapi/design-system");
const { default: Tags } =
  await import("../../node_modules/strapi-plugin-tagsinput/dist/_chunks/Input-DUnG8vg6.mjs");

afterEach(cleanup);

test("commits a tag on blur, notifies the form, reloads it and removes the last tag", async () => {
  let saved: unknown;
  function Editor({ initial = null }: { initial?: unknown }) {
    const [value, setValue] = React.useState(initial);
    return (
      <IntlProvider locale="en">
        <DesignSystemProvider>
          <Tags
            name="tags"
            attribute={{ type: "json" }}
            value={value}
            onChange={({ target }: any) => {
              setValue(target.value);
            }}
          />
          <button
            disabled={value === initial}
            onClick={() => {
              saved = JSON.parse(JSON.stringify(value));
            }}
          >
            Save
          </button>
        </DesignSystemProvider>
      </IntlProvider>
    );
  }
  let view = render(<Editor />);
  const input = view.container.querySelector("input")!;
  fireEvent.change(input, { target: { value: "Travel" } });
  fireEvent.blur(input);
  expect(
    (view.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.click(view.getByRole("button", { name: "Save" }));
  expect(saved).toEqual([{ name: "Travel" }]);
  view.unmount();
  view = render(<Editor initial={saved} />);
  expect(view.getByText("Travel")).toBeTruthy();
  fireEvent.keyDown(view.container.querySelector("input")!, {
    key: "Backspace",
    keyCode: 8,
  });
  fireEvent.click(view.getByRole("button", { name: "Save" }));
  expect(saved).toEqual([]);
});
