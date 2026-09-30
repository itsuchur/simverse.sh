"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";

import { excludePackageCodeAction, restorePackageCodeAction } from "./actions";
import type { PackageProvider } from "./provider-tabs";

export function PackageExclusionButton({
  provider,
  packageCode,
  excluded = false,
}: {
  provider: PackageProvider;
  packageCode: string;
  excluded?: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      className="whitespace-nowrap"
      variant={excluded ? "outline" : "destructive"}
      disabled={pending}
      onClick={() => {
        setPending(true);
        const action = excluded
          ? restorePackageCodeAction
          : excludePackageCodeAction;
        void action(provider, packageCode).finally(() => {
          setPending(false);
        });
      }}
    >
      {pending ? "Saving…" : excluded ? "Restore" : "Exclude"}
    </Button>
  );
}
