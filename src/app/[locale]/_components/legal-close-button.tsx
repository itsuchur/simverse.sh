"use client";

import { XIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { useRouter } from "~/i18n/navigation";
import { useMiniappPath } from "~/lib/use-miniapp-path";

export function LegalCloseButton() {
  const router = useRouter();
  const profileHref = useMiniappPath("/profile");

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="fixed top-3 right-3 z-50"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(profileHref);
        }
      }}
    >
      <XIcon />
      <span className="sr-only">Close</span>
    </Button>
  );
}
