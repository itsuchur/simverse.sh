import { ChevronRight, type LucideIcon } from "lucide-react";

import { ProfileExternalLink } from "./profile-external-link";
import { Card, CardTitle } from "~/components/ui/card";
import { Link } from "~/i18n/navigation";

export type ProfileOption = {
  label: string;
  icon: LucideIcon;
  href?: "/help" | "/refund-policy" | "/tos" | "/privacy-policy";
  externalHref?: string;
  telegramHref?: string;
};

export function ProfileOptionCard({ option }: { option: ProfileOption }) {
  const Icon = option.icon;
  // Use a plain flex row — nesting CardDescription inside CardHeader trips
  // the header's has-[slot] auto-grid and misplaces the icon/chevron.
  const isLink = Boolean(
    option.href ?? option.externalHref ?? option.telegramHref,
  );
  const body = (
    <Card
      size="sm"
      className={isLink ? "hover:bg-muted/40 transition-colors" : undefined}
    >
      <div className="flex items-center gap-3 px-(--card-spacing)">
        <span className="bg-muted text-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
          <Icon className="size-4" aria-hidden />
        </span>
        <CardTitle className="min-w-0 flex-1">{option.label}</CardTitle>
        {isLink ? (
          <ChevronRight
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
        ) : null}
      </div>
    </Card>
  );

  if (option.telegramHref) {
    return (
      <ProfileExternalLink href={option.telegramHref} telegram>
        {body}
      </ProfileExternalLink>
    );
  }

  if (option.externalHref) {
    return (
      <ProfileExternalLink href={option.externalHref}>
        {body}
      </ProfileExternalLink>
    );
  }

  if (option.href) {
    return (
      <Link href={option.href} className="block">
        {body}
      </Link>
    );
  }

  return body;
}
