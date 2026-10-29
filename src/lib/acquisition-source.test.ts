import { expect, test } from "bun:test";

import {
  classifyStartParam,
  classifyStartPayload,
  firstTouchSource,
  FIRST_TOUCH_WINDOW_MS,
  isWithinFirstTouchWindow,
  reportedAcquisitionSource,
  startCommandPayload,
  startParamFromInitData,
  startParamPage,
  startPayloadSource,
} from "./acquisition-source";

const allowed = new Set(["src_instagram", "src_youtube"]);

test("a src_ code is an acquisition source and does not route", () => {
  expect(classifyStartParam("src_instagram")).toEqual({
    kind: "source",
    source: "src_instagram",
  });
  expect(startParamPage("src_instagram")).toBeNull();
  expect(firstTouchSource("src_instagram", allowed)).toBe("src_instagram");
  expect(startParamPage(`src_${"a".repeat(60)}`)).toBeNull();
  expect(classifyStartParam(`src_${"a".repeat(60)}`).kind).toBe("source");
});

test("payment codes route and are not stored as a source", () => {
  expect(startParamPage("successful_payment")).toBe("/successful-payment");
  expect(startParamPage("failed_payment")).toBe("/failed-payment");
  expect(firstTouchSource("successful_payment", allowed)).toBe("organic");
  expect(firstTouchSource("failed_payment", allowed)).toBe("organic");
  expect(classifyStartPayload("successful_payment", allowed).kind).toBe(
    "navigation",
  );
});

test("a missing start param is organic", () => {
  for (const value of [null, undefined, ""]) {
    expect(classifyStartParam(value)).toEqual({ kind: "organic" });
    expect(startParamPage(value)).toBeNull();
    expect(firstTouchSource(value, allowed)).toBe("organic");
    expect(startPayloadSource(value, allowed)).toBe("organic");
  }
});

test("an unregistered or malformed payload is unknown", () => {
  for (const value of [
    "src_",
    "src_bad.char",
    "SRC_instagram",
    `src_${"a".repeat(61)}`,
    "instagram",
  ]) {
    expect(classifyStartParam(value)).toEqual({ kind: "organic" });
    expect(startParamPage(value)).toBeNull();
    expect(classifyStartPayload(value, allowed)).toEqual({ kind: "unknown" });
    expect(firstTouchSource(value, allowed)).toBe("unknown");
    expect(startPayloadSource(value, allowed)).toBe("unknown");
  }
  expect(classifyStartPayload("src_other", allowed)).toEqual({
    kind: "unknown",
  });
  expect(startPayloadSource("src_other", allowed)).toBe("unknown");
});

test("start_param is read from validated initData", () => {
  expect(
    startParamFromInitData("user=%7B%7D&start_param=src_youtube&hash=abc"),
  ).toBe("src_youtube");
  expect(startParamFromInitData("user=%7B%7D&hash=abc")).toBeNull();
});

test("first touch is only within an hour of registration", () => {
  const createdAt = new Date("2026-10-27T12:00:00Z");
  expect(
    isWithinFirstTouchWindow(
      createdAt,
      createdAt.getTime() + FIRST_TOUCH_WINDOW_MS,
    ),
  ).toBe(true);
  expect(
    isWithinFirstTouchWindow(
      createdAt,
      createdAt.getTime() + FIRST_TOUCH_WINDOW_MS + 1,
    ),
  ).toBe(false);
});

test("a /start payload is a source only when registered, and a payment payload is ignored", () => {
  expect(startCommandPayload("/start src_instagram")).toBe("src_instagram");
  expect(startCommandPayload("/start@simversebot src_youtube")).toBe(
    "src_youtube",
  );
  expect(startCommandPayload("/start")).toBe("");
  expect(startPayloadSource("src_instagram", allowed)).toBe("src_instagram");
  expect(startPayloadSource("src_instagram", new Set())).toBe("unknown");
  expect(startPayloadSource("", allowed)).toBe("organic");
  expect(startPayloadSource("src_", allowed)).toBe("unknown");
  expect(startPayloadSource("successful_payment", allowed)).toBeNull();
  expect(startPayloadSource("failed_payment", allowed)).toBeNull();
});

test("a missing stored source is reported as unknown", () => {
  expect(reportedAcquisitionSource(null)).toBe("unknown");
  expect(reportedAcquisitionSource("src_instagram")).toBe("src_instagram");
  expect(reportedAcquisitionSource("organic")).toBe("organic");
  expect(reportedAcquisitionSource("unknown")).toBe("unknown");
});
