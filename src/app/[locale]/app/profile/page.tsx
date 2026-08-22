/* eslint-disable @next/next/no-img-element -- Telegram avatar URLs are
   remote and short-lived; next/image optimization adds no value here. */
import {
  CircleHelp,
  FileText,
  MessageCircle,
  RotateCcw,
  Settings,
  Shield,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Acknowledgments } from "./acknowledgments";
import { LocaleSwitcher } from "../_components/locale-switcher";
import { ProfileOptionCard, type ProfileOption } from "./profile-option-card";
import { TransactionHistory, type HistoryOrder } from "./transaction-history";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { paymentStatus } from "~/lib/order-status";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

export const dynamic = "force-dynamic";

const HELP_URL = "https://help.simverse.sh";
const SUPPORT_URL = "https://t.me/simversesupport";

export default async function AppProfile() {
  // The /app layout gates rendering, but pages showing user data must not
  // rely on it — check the session where the data is used.
  const session = await getSession();

  if (!session) {
    return null;
  }

  const t = await getTranslations("Profile");
  const { user } = session;

  const rows = await db.order.findMany({
    where: { userId: session.user.id, paymentStatus: paymentStatus.paid },
    orderBy: { createdAt: "desc" },
    select: {
      orderUuid: true,
      packageName: true,
      countryCode: true,
      dataAmountMb: true,
      validityDays: true,
      priceAmount: true,
      currency: true,
      paymentProvider: true,
      paidAt: true,
      createdAt: true,
    },
  });

  const orders: HistoryOrder[] = rows.map((row) => ({
    orderUuid: row.orderUuid,
    packageName: row.packageName,
    countryCode: row.countryCode,
    dataAmountMb: row.dataAmountMb,
    validityDays: row.validityDays,
    priceAmount: row.priceAmount.toString(),
    currency: row.currency,
    paymentProvider: row.paymentProvider,
    purchasedAt: (row.paidAt ?? row.createdAt).toISOString(),
  }));

  const preferenceOption: ProfileOption = {
    label: t("preferences"),
    icon: Settings,
  };

  const helpOption: ProfileOption = {
    label: t("help"),
    icon: CircleHelp,
    externalHref: HELP_URL,
  };

  const legalOptions: ProfileOption[] = [
    {
      label: t("refundPolicy"),
      icon: RotateCcw,
      href: "/refund-policy",
    },
    {
      label: t("termsOfService"),
      icon: FileText,
      href: "/tos",
    },
    {
      label: t("privacyPolicy"),
      icon: Shield,
      href: "/privacy-policy",
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
        <CardHeader>
          <div className="flex items-center gap-3">
            {user.image ? (
              <img
                src={user.image}
                alt=""
                className="border-border size-12 rounded-full border object-cover"
              />
            ) : (
              <div className="bg-muted flex size-12 items-center justify-center rounded-full text-lg font-medium">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <CardTitle>{user.name}</CardTitle>
              <CardDescription>
                {t("signedInWithTelegram")}
                {user.isPremium ? ` · ${t("premium")}` : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <LocaleSwitcher />

      <ProfileOptionCard option={preferenceOption} />
      <TransactionHistory orders={orders} />
      <ProfileOptionCard option={helpOption} />
      {legalOptions.map((option) => (
        <ProfileOptionCard key={option.label} option={option} />
      ))}
      <ProfileOptionCard option={supportOption} />
      <Acknowledgments />
    </main>
  );
}
