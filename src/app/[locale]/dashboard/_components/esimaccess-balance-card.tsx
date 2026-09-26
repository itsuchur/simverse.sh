import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  formatEsimAccessBalanceUsd,
  type EsimAccessBalanceResult,
} from "~/server/dashboard/esimaccess-balance";

export function EsimAccessBalanceCard({
  balance,
}: {
  balance: EsimAccessBalanceResult;
}) {
  return (
    <Card size="sm" className="max-w-md">
      <CardHeader>
        <CardDescription>eSIM Access</CardDescription>
        <CardTitle className="text-lg">Current balance</CardTitle>
      </CardHeader>
      <CardContent>
        {balance.ok ? (
          <p className="text-3xl font-semibold tracking-tight tabular-nums">
            {formatEsimAccessBalanceUsd(balance.balanceUsd)}
          </p>
        ) : (
          <p className="text-muted-foreground text-base">
            Unable to load balance
          </p>
        )}
      </CardContent>
    </Card>
  );
}
