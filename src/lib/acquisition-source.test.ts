import { expect, test } from "bun:test";

import {
  classifyStartParam,
  firstTouchSource,
  FIRST_TOUCH_WINDOW_MS,
  isWithinFirstTouchWindow,
  reportedAcquisitionSource,
  startCommandPayload,
  startParamFromInitData,
  startParamPage,
  startPayloadSource,
} from "./acquisition-source";

test("a src_ code is an acquisition source and does not route", () => {
  expect(classifyStartParam("src_instagram")).toEqual({
    kind: "source",
    source: "src_instagram",
  });
  expect(startParamPage("src_instagram")).toBeNull();
  expect(firstTouchSource("src_instagram")).toBe("src_instagram");
  expect(startParamPage(`src_${"a".repeat(60)}`)).toBeNull();
  expect(classifyStartParam(`src_${"a".repeat(60)}`).kind).toBe("source");
});

test("payment codes route and are not stored as a source", () => {
  expect(startParamPage("successful_payment")).toBe("/successful-payment");
  expect(startParamPage("failed_payment")).toBe("/failed-payment");
  expect(firstTouchSource("successful_payment")).toBe("organic");
  expect(firstTouchSource("failed_payment")).toBe("organic");
});

test("a missing or invalid src_ value opens as organic", () => {
  for (const value of [
    null,
    undefined,
    "",
    "src_",
    "src_bad.char",
    "SRC_instagram",
    `src_${"a".repeat(61)}`,
    "instagram",
  ]) {
    expect(classifyStartParam(value)).toEqual({ kind: "organic" });
    expect(startParamPage(value)).toBeNull();
    expect(firstTouchSource(value)).toBe("organic");
  }
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

test("a /start payload is a source, and a payment payload is ignored", () => {
  expect(startCommandPayload("/start src_instagram")).toBe("src_instagram");
  expect(startCommandPayload("/start@simversebot src_youtube")).toBe(
    "src_youtube",
  );
  expect(startCommandPayload("/start")).toBe("");
  expect(startPayloadSource("src_instagram")).toBe("src_instagram");
  expect(startPayloadSource("")).toBe("organic");
  expect(startPayloadSource("src_")).toBe("organic");
  expect(startPayloadSource("successful_payment")).toBeNull();
  expect(startPayloadSource("failed_payment")).toBeNull();
});

test("a missing stored source is reported as unknown", () => {
  expect(reportedAcquisitionSource(null)).toBe("unknown");
  expect(reportedAcquisitionSource("src_instagram")).toBe("src_instagram");
  expect(reportedAcquisitionSource("organic")).toBe("organic");
});
