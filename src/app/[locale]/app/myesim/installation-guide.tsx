"use client";

import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { esimProvisioningUrl } from "~/lib/esim-provisioning";
import { captureAppEvent } from "~/lib/posthog/browser";

function openProvisioningInstall(
  os: "apple" | "android",
  cardData: string,
): void {
  const url = esimProvisioningUrl(os, cardData);
  const telegramOpenLink = (
    window as Window & {
      Telegram?: { WebApp?: { openLink?: (link: string) => void } };
    }
  ).Telegram?.WebApp?.openLink;
  if (typeof telegramOpenLink === "function") {
    telegramOpenLink(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm leading-6">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

export function InstallationGuide({
  platform,
  cardData,
}: {
  platform: "ios" | "android" | "unknown" | null;
  cardData: string | null;
}) {
  const t = useTranslations("MyEsims");
  const showIos = platform !== "android";
  const showAndroid = platform !== "ios";
  const os =
    platform === "ios" ? "apple" : platform === "android" ? "android" : null;

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          captureAppEvent("install_guide_opened", {
            platform: platform ?? "unknown",
          });
        }
      }}
    >
      <div className="flex w-full flex-col items-center gap-2">
        {cardData && os ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => {
              openProvisioningInstall(os, cardData);
            }}
          >
            {t("install")}
          </Button>
        ) : null}
        {cardData && platform === "unknown" ? (
          <DialogTrigger
            render={<Button type="button" size="lg" className="w-full" />}
          >
            {t("install")}
          </DialogTrigger>
        ) : null}
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="link"
              className="text-muted-foreground h-auto px-0"
            />
          }
        >
          {t("howToInstall")}
        </DialogTrigger>
      </div>
      <DialogContent className="max-h-[min(88vh,36rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("guideTitle")}</DialogTitle>
          <DialogDescription>{t("guideDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          {showIos ? (
            <section className="flex flex-col gap-3">
              {showAndroid ? (
                <h3 className="text-sm font-medium">{t("guideIosTitle")}</h3>
              ) : null}
              <StepList
                steps={[t("guideIos1"), t("guideIos2"), t("guideIos3")]}
              />
              {cardData && platform === "unknown" ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    openProvisioningInstall("apple", cardData);
                  }}
                >
                  {t("install")}
                </Button>
              ) : null}
            </section>
          ) : null}
          {showAndroid ? (
            <section className="flex flex-col gap-3">
              {showIos ? (
                <h3 className="text-sm font-medium">
                  {t("guideAndroidTitle")}
                </h3>
              ) : null}
              <StepList
                steps={[
                  t("guideAndroid1"),
                  t("guideAndroid2"),
                  t("guideAndroid3"),
                ]}
              />
              {cardData && platform === "unknown" ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => {
                    openProvisioningInstall("android", cardData);
                  }}
                >
                  {t("install")}
                </Button>
              ) : null}
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
