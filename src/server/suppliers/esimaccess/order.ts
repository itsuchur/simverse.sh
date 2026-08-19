import "server-only";

import { esimAccessPost } from "~/server/suppliers/esimaccess/client";

export type EsimAccessOrderResult = {
  orderNo: string;
  transactionId?: string;
};

export type EsimAccessProfile = {
  iccid: string;
  ac?: string;
  qrCodeUrl?: string;
  smdpAddress?: string;
  esimStatus?: string;
  smdpStatus?: string;
};

type OrderResponse = {
  orderNo?: string;
  transactionId?: string;
};

type QueryResponse = {
  esimList?: unknown[];
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function smdpFromActivationCode(ac: string | undefined): string | undefined {
  if (!ac) return undefined;
  const parts = ac.split("$");
  if (parts.length >= 2 && parts[1]) {
    return parts[1];
  }
  return undefined;
}

function mapProfile(raw: unknown): EsimAccessProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const iccid = asString(row.iccid);
  if (!iccid) return null;

  const ac = asString(row.ac);
  return {
    iccid,
    ac,
    qrCodeUrl: asString(row.qrCodeUrl),
    smdpAddress: asString(row.smdpAddress) ?? smdpFromActivationCode(ac),
    esimStatus: asString(row.esimStatus),
    smdpStatus: asString(row.smdpStatus),
  };
}

export async function orderEsimAccessPackage(input: {
  transactionId: string;
  packageCode: string;
}): Promise<EsimAccessOrderResult> {
  const envelope = await esimAccessPost<OrderResponse>("/esim/order", {
    transactionId: input.transactionId,
    packageInfoList: [{ packageCode: input.packageCode, count: 1 }],
  });

  const orderNo = envelope.obj?.orderNo;
  if (!orderNo) {
    throw new Error("eSIM Access order did not return orderNo");
  }

  return {
    orderNo,
    transactionId: envelope.obj?.transactionId,
  };
}

export async function queryEsimAccessProfiles(
  orderNo: string,
): Promise<EsimAccessProfile[]> {
  const envelope = await esimAccessPost<QueryResponse>("/esim/query", {
    orderNo,
    pager: { pageNum: 1, pageSize: 10 },
  });

  return (envelope.obj?.esimList ?? [])
    .map(mapProfile)
    .filter((profile): profile is EsimAccessProfile => profile !== null);
}
