import type { ReactNode } from "react";
import { TelegramAuth } from "~/app/_components/telegram-auth";

export default function MiniAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <TelegramAuth />
      {children}
    </>
  );
}