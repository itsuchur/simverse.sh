/* eslint-disable @next/next/no-img-element -- Telegram avatar URLs are
   remote and short-lived; next/image optimization adds no value here. */
import Link from "next/link";
import {
  ChevronRight,
  FileText,
  History,
  RotateCcw,
  Settings,
  Shield,
} from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { getSession } from "~/server/better-auth/server";

type ProfileOption = {
  label: string;
  icon: typeof Settings;
  href?: string;
};

const profileOptions: ProfileOption[] = [
  {
    label: "Preferences",
    icon: Settings,
  },
  {
    label: "Transaction History",
    icon: History,
  },
  {
    label: "Refund Policy",
    icon: RotateCcw,
    href: "/refund-policy",
  },
  {
    label: "Terms of Service",
    icon: FileText,
    href: "/tos",
  },
  {
    label: "Privacy Policy",
    icon: Shield,
    href: "/privacy-policy",
  },
];

function ProfileOptionCard({ option }: { option: ProfileOption }) {
  const Icon = option.icon;
  // Use a plain flex row — nesting CardDescription inside CardHeader trips
  // the header's has-[slot] auto-grid and misplaces the icon/chevron.
  const body = (
    <Card
      size="sm"
      className={
        option.href ? "transition-colors hover:bg-muted/40" : undefined
      }
    >
      <div className="flex items-center gap-3 px-(--card-spacing)">
        <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-4" aria-hidden />
        </span>
        <CardTitle className="min-w-0 flex-1">{option.label}</CardTitle>
        {option.href ? (
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        ) : null}
      </div>
    </Card>
  );

  if (option.href) {
    return (
      <Link href={option.href} className="block">
        {body}
      </Link>
    );
  }

  return body;
}

export default async function AppProfile() {
  // The /app layout gates rendering, but pages showing user data must not
  // rely on it — check the session where the data is used.
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { user } = session;

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
                Signed in with Telegram
                {user.isPremium ? " · Premium" : ""}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {profileOptions.map((option) => (
        <ProfileOptionCard key={option.label} option={option} />
      ))}
    </main>
  );
}
