import { describe, expect, it } from "vitest";
import { isInvalidFcmToken } from "../fcm.server";

describe("isInvalidFcmToken", () => {
  it("removes unregistered and missing tokens", () => {
    expect(isInvalidFcmToken(404, '{"status":"NOT_FOUND"}')).toBe(true);
    expect(isInvalidFcmToken(400, '{"errorCode":"UNREGISTERED"}')).toBe(true);
  });

  it("removes INVALID_ARGUMENT only when the registration token is invalid", () => {
    expect(
      isInvalidFcmToken(
        400,
        '{"status":"INVALID_ARGUMENT","fieldViolations":[{"field":"message.token"}]}',
      ),
    ).toBe(true);
    expect(
      isInvalidFcmToken(
        400,
        '{"status":"INVALID_ARGUMENT","message":"Invalid value at message.notification.title"}',
      ),
    ).toBe(false);
  });

  it("keeps tokens for retryable delivery failures", () => {
    expect(isInvalidFcmToken(429, "quota exceeded")).toBe(false);
    expect(isInvalidFcmToken(503, "unavailable")).toBe(false);
  });
});