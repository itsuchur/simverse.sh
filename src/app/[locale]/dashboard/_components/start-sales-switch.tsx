"use client";

import { useState } from "react";

import { Switch } from "~/components/ui/switch";

import { setSalesActiveAction } from "../actions";

export function StartSalesSwitch({
  initialActive,
}: {
  initialActive: boolean;
}) {
  const [active, setActive] = useState(initialActive);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <label
        htmlFor="start-sales"
        className="text-lg font-medium tracking-tight"
      >
        Start Sales
      </label>
      <Switch
        id="start-sales"
        size="lg"
        checked={active}
        disabled={pending}
        onCheckedChange={(checked) => {
          setPending(true);
          setActive(checked);
          void setSalesActiveAction(checked)
            .catch(() => {
              setActive(!checked);
            })
            .finally(() => {
              setPending(false);
            });
        }}
      />
    </div>
  );
}
