/* eslint-disable @next/next/no-img-element -- Telegram avatar URLs are
   remote and short-lived; next/image optimization adds no value here. */
import {
  CircleHelp,
  FileText,
  MessageCircle,
  RotateCcw,
  Shield,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Acknowledgments } from "./acknowledgments";
import { DeleteAccount } from "./delete-account";
import { Preferences } from "./preferences";
import { ProfileOptionCard, type ProfileOption } from "./profile-option-card";
import { TransactionHistory } from "./transaction-history";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getPathname } from "~/i18n/navigation";
import { marketingUrl } from "~/lib/marketing-url";
import { getSession } from "~/server/better-auth/server";

export const dynamic = "force-dynamic";

const SUPPORT_URL = "https://t.me/simversesupport";

export default async function AppProfile() {
  // The /app layout gates rendering, but pages showing user data must not
  // rely on it — check the session where the data is used.
  const session = await getSession();

  if (!session) {
    return null;
  }

  const t = await getTranslations("Profile");
  const locale = await getLocale();
  const { user } = session;

  const helpOption: ProfileOption = {
    label: t("help"),
    icon: CircleHelp,
    href: "/help",
  };

  const legalOptions: ProfileOption[] = [
    {
      label: t("refundPolicy"),
      icon: RotateCcw,
      externalHref: marketingUrl(
        getPathname({ href: "/refund-policy", locale }),
      ),
    },
    {
      label: t("termsOfService"),
      icon: FileText,
      externalHref: marketingUrl(getPathname({ href: "/tos", locale })),
    },
    {
      label: t("privacyPolicy"),
      icon: Shield,
      externalHref: marketingUrl(
        getPathname({ href: "/privacy-policy", locale }),
      ),
    },
  ];

  const supportOption: ProfileOption = {
    label: t("contactSupport"),
    icon: MessageCircle,
    telegramHref: SUPPORT_URL,
  };

  return (
    <main className="space-y-3 pt-2">
      <Card>
        <CardHeader className="min-w-0">
          <div className="flex min-w-0 items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="border-border size-12 shrink-0 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate" title={user.name}>
                {user.name}
              </CardTitle>
              <CardDescription>
                {t("signedInWithTelegram")}
                {user.isPremium ? ` · ${t("premium")}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Preferences />
      <TransactionHistory />
      <ProfileOptionCard option={helpOption} />
      {legalOptions.map((option) => (
        <ProfileOptionCard key={option.label} option={option} />
      ))}
      <ProfileOptionCard option={supportOption} />
      <Acknowledgments />
      <DeleteAccount />
    </main>
  );
}
