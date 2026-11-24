import { describe, expect, it } from "vitest";
import { buildFcmMessage, isInvalidFcmToken } from "../fcm.server";

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
describe("buildFcmMessage", () => {
  it("leaves plain pushes unchanged (no mutable-content, no image, url only in data)", () => {
    const m = buildFcmMessage("tok", { title: "Hi", body: "There", url: "/home" }, 3).message;
    expect(m.data).toEqual({ url: "/home" });
    expect(m.apns.payload.aps).toEqual({ sound: "default", "content-available": 1, badge: 3 });
    expect("fcm_options" in m.apns).toBe(false);
    expect("image" in m.android.notification).toBe(false);
  });

  it("rich check-in pushes carry mutable-content, thread, image and sender data", () => {
    const m = buildFcmMessage("tok", {
      title: "Jose · Morning Crew",
      body: "Checked in: Workout 💪",
      url: "/home?post=p1",
      sender: { id: "u1", name: "Jose", avatarUrl: "https://x/a.png" },
      imageUrl: "https://x/t.jpg",
      threadId: "g1",
    }).message;
    expect(m.apns.payload.aps["mutable-content"]).toBe(1);
    expect(m.apns.payload.aps["thread-id"]).toBe("g1");
    expect(m.apns).toMatchObject({ fcm_options: { image: "https://x/t.jpg" } });
    expect(m.android.notification).toMatchObject({ image: "https://x/t.jpg" });
    expect(m.data).toEqual({
      url: "/home?post=p1",
      kind: "checkin",
      sender_id: "u1",
      sender_name: "Jose",
      sender_avatar_url: "https://x/a.png",
      image_url: "https://x/t.jpg",
      thread_id: "g1",
    });
  });

  it("a check-in without media still gets the photo style but no image", () => {
    const m = buildFcmMessage("tok", { title: "T", body: "B", sender: { id: "u1", name: "Jose", avatarUrl: null }, threadId: "g1" }).message;
    expect(m.apns.payload.aps["mutable-content"]).toBe(1);
    expect("fcm_options" in m.apns).toBe(false);
    expect(m.data["image_url"]).toBe("");
    expect(m.data["sender_avatar_url"]).toBe("");
  });
});
