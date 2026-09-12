import { z } from "zod";
import { NextResponse } from "next/server";

export const checkoutRequestSchema = z.object({
  cartRevision: z.string().uuid(),
  locale: z.enum(["en", "ru"]).optional(),
});

export function invoiceResponse(orderUuid: string, invoiceUrl: string | null) {
  if (!invoiceUrl)
    return Response.json({ error: "invoice_in_progress" }, { status: 409 });
  const response = NextResponse.json({ orderUuid, invoiceUrl });
  // Survives external provider navigation and Telegram's return deep link.
  response.cookies.set("checkout_order", orderUuid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 86400,
  });
  return response;
}
