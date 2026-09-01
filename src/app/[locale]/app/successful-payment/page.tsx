import { getTranslations } from "next-intl/server";

import { PaymentResultRedirect } from "../_components/payment-result-redirect";

const SUCCESS_LOTTIE =
  "https://lottie.host/ea6f4a5a-1581-4c04-af2d-fb84eaf4dd50/dlqruSMTw2.lottie";

export default async function SuccessfulPaymentPage() {
  const t = await getTranslations("PaymentResult");
  const tNav = await getTranslations("Nav");

  return (
    <PaymentResultRedirect
      src={SUCCESS_LOTTIE}
      page="/myesim"
      title={t("successTitle")}
      description={t("successRedirect", { destination: tNav("myEsims") })}
    />
  );
}
