"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { updateDataUsageNotificationsAction } from "./actions";
import { Switch } from "~/components/ui/switch";

export function DataUsageNotificationsSwitch({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const t = useTranslations("Profile");
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-base leading-none font-medium">
          {t("notifications")}
        </h3>
        <p className="text-muted-foreground text-sm">
          {t("notificationsDescription")}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <label
          htmlFor="data-usage-notifications"
          className="text-sm font-medium"
        >
          {t("dataUsageNotifications")}
        </label>
        <Switch
          id="data-usage-notifications"
          checked={enabled}
          disabled={pending}
          onCheckedChange={(checked) => {
            setPending(true);
            setEnabled(checked);
            void updateDataUsageNotificationsAction(checked)
              .catch(() => {
                setEnabled(!checked);
              })
              .finally(() => {
                setPending(false);
              });
          }}
        />
      </div>
    </section>
  );
}
