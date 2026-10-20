import "server-only";

import { esimAccessPost } from "~/server/suppliers/esimaccess/client";

export type EsimAccessOrderResult = {
  orderNo: string;
  transactionId?: string;
};

export type EsimAccessProfile = {
  iccid: string;
  esimTranNo?: string;
  ac?: string;
  qrCodeUrl?: string;
  smdpAddress?: string;
  esimStatus?: string;
  smdpStatus?: string;
  activateTime?: string | null;
  expiredTime?: string | null;
  totalVolume?: number;
  orderUsage?: number;
};

const UNUSED_ESIM_STATUSES = new Set(["GOT_RESOURCE", "NOT_ACTIVE"]);
const UNUSED_SMDP_STATUSES = new Set(["RELEASED"]);

export function isUnusedEsimAccessProfile(profile: EsimAccessProfile) {
  const esimOk =
    profile.esimStatus === undefined ||
    UNUSED_ESIM_STATUSES.has(profile.esimStatus);
  const smdpOk =
    profile.smdpStatus === undefined ||
    UNUSED_SMDP_STATUSES.has(profile.smdpStatus);
  return esimOk && smdpOk;
}

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

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asProviderTime(value: unknown): string | null | undefined {
  if (value === null) return null;
  return asString(value);
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
  const activateTime = asProviderTime(row.activateTime);
  const expiredTime = asProviderTime(row.expiredTime);
  const totalVolume = asFiniteNumber(row.totalVolume);
  const orderUsage = asFiniteNumber(row.orderUsage);
  return {
    iccid,
    esimTranNo: asString(row.esimTranNo),
    ac,
    qrCodeUrl: asString(row.qrCodeUrl),
    smdpAddress: asString(row.smdpAddress) ?? smdpFromActivationCode(ac),
    esimStatus: asString(row.esimStatus),
    smdpStatus: asString(row.smdpStatus),
    ...(activateTime !== undefined ? { activateTime } : {}),
    ...(expiredTime !== undefined ? { expiredTime } : {}),
    ...(totalVolume !== undefined ? { totalVolume } : {}),
    ...(orderUsage !== undefined ? { orderUsage } : {}),
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

export async function cancelEsimAccessProfile(esimTranNo: string) {
  await esimAccessPost("/esim/cancel", { esimTranNo });
}

export type EsimAccessUsage = {
  dataUsage: number;
  totalData: number;
};

type UsageResponse = {
  esimUsageList?: unknown[];
};

/** Latest supplier reading. Usage is delayed by a few hours, not live. */
export async function queryEsimAccessUsage(
  esimTranNo: string,
): Promise<EsimAccessUsage> {
  const envelope = await esimAccessPost<UsageResponse>("/esim/usage/query", {
    esimTranNoList: [esimTranNo],
  });

  for (const raw of envelope.obj?.esimUsageList ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (asString(row.esimTranNo) !== esimTranNo) continue;
    const dataUsage = asFiniteNumber(row.dataUsage);
    const totalData = asFiniteNumber(row.totalData);
    if (
      dataUsage === undefined ||
      totalData === undefined ||
      !Number.isSafeInteger(dataUsage) ||
      !Number.isSafeInteger(totalData) ||
      dataUsage < 0 ||
      totalData < 0
    ) {
      continue;
    }
    return { dataUsage, totalData };
  }

  throw new Error("eSIM Access usage query did not return usage");
}

export type EsimAccessTopUpResult = {
  transactionId?: string;
  iccid: string;
  expiredTime?: string;
  totalVolume?: number;
  totalDuration?: number;
  orderUsage?: number;
};

type TopUpResponse = {
  transactionId?: string;
  iccid?: string;
  expiredTime?: string;
  totalVolume?: number;
  totalDuration?: number;
  orderUsage?: number;
};

/** Adds a package, or day-pass days, to an existing profile. */
export async function topUpEsimAccessProfile(input: {
  iccid?: string;
  esimTranNo?: string;
  packageCode: string;
  transactionId: string;
  amount: number;
  periodNum?: number;
}): Promise<EsimAccessTopUpResult> {
  const esimTranNo =
    typeof input.esimTranNo === "string" && input.esimTranNo.length > 0
      ? input.esimTranNo
      : undefined;
  const requestIccid =
    typeof input.iccid === "string" && input.iccid.length > 0
      ? input.iccid
      : undefined;
  if (!esimTranNo && !requestIccid) {
    throw new Error("eSIM Access topup requires esimTranNo or iccid");
  }

  const envelope = await esimAccessPost<TopUpResponse>("/esim/topup", {
    ...(esimTranNo ? { esimTranNo, iccid: "" } : { iccid: requestIccid! }),
    packageCode: input.packageCode,
    transactionId: input.transactionId,
    amount: input.amount,
    ...(input.periodNum !== undefined ? { periodNum: input.periodNum } : {}),
  });

  const iccid = asString(envelope.obj?.iccid);
  if (!iccid) {
    throw new Error("eSIM Access topup did not return iccid");
  }

  const expiredTime = asString(envelope.obj?.expiredTime);
  const totalVolume = asFiniteNumber(envelope.obj?.totalVolume);
  const totalDuration = asFiniteNumber(envelope.obj?.totalDuration);
  const orderUsage = asFiniteNumber(envelope.obj?.orderUsage);
  return {
    transactionId: asString(envelope.obj?.transactionId),
    iccid,
    ...(expiredTime ? { expiredTime } : {}),
    ...(totalVolume !== undefined ? { totalVolume } : {}),
    ...(totalDuration !== undefined ? { totalDuration } : {}),
    ...(orderUsage !== undefined ? { orderUsage } : {}),
  };
}
