import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import type { WelcomeLocale } from "~/server/telegram/start-welcome";

const colors = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  accent: "#0f172a",
  surface: "#f8fafc",
};

function Layout({
  locale,
  preview,
  children,
}: {
  locale: WelcomeLocale;
  preview: string;
  children: ReactNode;
}) {
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: "#ffffff",
          color: colors.text,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <Container style={{ maxWidth: 480, padding: "24px 16px" }}>
          <Text style={{ fontSize: 18, fontWeight: 700, margin: "0 0 24px" }}>
            Simverse
          </Text>
          {children}
          <Hr style={{ borderColor: colors.border, margin: "32px 0 16px" }} />
          <Text style={{ color: colors.muted, fontSize: 12, margin: 0 }}>
            <Link href="https://simverse.sh" style={{ color: colors.muted }}>
              simverse.sh
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function PrimaryButton({ href, children }: { href: string; children: string }) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: colors.accent,
        borderRadius: 10,
        color: "#ffffff",
        display: "block",
        fontSize: 15,
        fontWeight: 600,
        margin: "0 0 12px",
        padding: "12px 16px",
        textAlign: "center",
      }}
    >
      {children}
    </Button>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return (
    <Text style={{ fontSize: 15, lineHeight: "24px", margin: "0 0 16px" }}>
      {children}
    </Text>
  );
}

const SIGN_IN_COPY: Record<
  WelcomeLocale,
  { subject: string; heading: string; expires: string; ignore: string }
> = {
  en: {
    subject: "Your Simverse sign-in code",
    heading: "Your sign-in code",
    expires: "Enter this code on simverse.sh. It expires in 10 minutes.",
    ignore: "If you didn't try to sign in, you can ignore this email.",
  },
  ru: {
    subject: "Код для входа в Simverse",
    heading: "Код для входа",
    expires: "Введите этот код на simverse.sh. Он действует 10 минут.",
    ignore: "Если вы не пытались войти, просто проигнорируйте это письмо.",
  },
};

export function signInCodeEmail(locale: WelcomeLocale, otp: string) {
  const copy = SIGN_IN_COPY[locale];
  return {
    subject: copy.subject,
    react: (
      <Layout locale={locale} preview={`${copy.heading}: ${otp}`}>
        <Heading as="h1" style={{ fontSize: 22, margin: "0 0 16px" }}>
          {copy.heading}
        </Heading>
        <Text
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            fontFamily: "ui-monospace, Menlo, Consolas, monospace",
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: 8,
            margin: "0 0 16px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          {otp}
        </Text>
        <Paragraph>{copy.expires}</Paragraph>
        <Text style={{ color: colors.muted, fontSize: 13, margin: 0 }}>
          {copy.ignore}
        </Text>
      </Layout>
    ),
  };
}

export type EsimDeliveryCopy = {
  ready: string;
  thanks: string;
  scanOrManual: string;
  manualOnly: string;
  smdpLabel: string;
  activationLabel: string;
  installIphone: string;
  installAndroid: string;
  myEsims: string;
  installGuide: string;
  installGuideUrl: string;
  saveDataGuide: string;
  saveDataGuideUrl: string;
};

function CodeBlock({ label, value }: { label: string; value: string }) {
  return (
    <Section style={{ margin: "0 0 12px" }}>
      <Text style={{ color: colors.muted, fontSize: 13, margin: "0 0 4px" }}>
        {label}
      </Text>
      <Text
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          fontSize: 14,
          margin: 0,
          padding: "8px 12px",
          wordBreak: "break-all",
        }}
      >
        {value}
      </Text>
    </Section>
  );
}

export function esimDeliveryEmail(input: {
  locale: WelcomeLocale;
  copy: EsimDeliveryCopy;
  title: string;
  planLine: string;
  qrUrl: string | null;
  smdp: string;
  activationCode: string;
  appleInstallUrl: string;
  androidInstallUrl: string;
  accountUrl: string;
}) {
  const { copy } = input;
  return {
    subject: `${copy.ready} ${input.title}`,
    react: (
      <Layout locale={input.locale} preview={copy.ready}>
        <Heading as="h1" style={{ fontSize: 22, margin: "0 0 8px" }}>
          {copy.ready}
        </Heading>
        <Paragraph>{copy.thanks}</Paragraph>
        <Text style={{ fontSize: 17, fontWeight: 600, margin: "0 0 4px" }}>
          {input.title}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 15, margin: "0 0 24px" }}>
          {input.planLine}
        </Text>
        <Paragraph>
          {input.qrUrl ? copy.scanOrManual : copy.manualOnly}
        </Paragraph>
        {input.qrUrl ? (
          <Img
            src={input.qrUrl}
            alt="eSIM QR code"
            width={220}
            height={220}
            style={{ margin: "0 auto 24px" }}
          />
        ) : null}
        <CodeBlock label={copy.smdpLabel} value={input.smdp} />
        <CodeBlock label={copy.activationLabel} value={input.activationCode} />
        <Section style={{ margin: "24px 0 8px" }}>
          <PrimaryButton href={input.appleInstallUrl}>
            {copy.installIphone}
          </PrimaryButton>
          <PrimaryButton href={input.androidInstallUrl}>
            {copy.installAndroid}
          </PrimaryButton>
        </Section>
        <Paragraph>
          <Link href={input.accountUrl}>{copy.myEsims}</Link>
          {" · "}
          <Link href={copy.installGuideUrl}>{copy.installGuide}</Link>
          {" · "}
          <Link href={copy.saveDataGuideUrl}>{copy.saveDataGuide}</Link>
        </Paragraph>
      </Layout>
    ),
  };
}

/** Short buyer notice: plain-text lines from the Telegram copy plus one button. */
export function noticeEmail(input: {
  locale: WelcomeLocale;
  subject: string;
  text: string;
  button?: { label: string; href: string };
}) {
  const paragraphs = input.text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  return {
    subject: input.subject,
    react: (
      <Layout locale={input.locale} preview={paragraphs[0] ?? input.subject}>
        {paragraphs.map((paragraph, index) => (
          <Paragraph key={index}>
            {paragraph.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </Paragraph>
        ))}
        {input.button ? (
          <PrimaryButton href={input.button.href}>
            {input.button.label}
          </PrimaryButton>
        ) : null}
      </Layout>
    ),
  };
}
