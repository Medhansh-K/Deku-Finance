import { describe, it, expect } from "vitest";
import { AppNotification, badgeLabel, bellAriaLabel, markRead, unreadIds } from "@/modules/notifications/unread";

const n = (id: string, read_at: string | null = null): AppNotification => ({
  id,
  kind: "gst_due",
  title: id,
  body: null,
  link: "/gst/file",
  payload: {},
  created_at: "2026-10-31T10:00:00Z",
  read_at,
});

describe("notification bell unread logic", () => {
  it("counts only unread rows", () => {
    expect(unreadIds([n("a"), n("b", "2026-10-31T11:00:00Z"), n("c")])).toEqual(["a", "c"]);
    expect(unreadIds([])).toEqual([]);
  });

  it("badge hides at zero and caps at 9+", () => {
    expect(badgeLabel(0)).toBeNull();
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(9)).toBe("9");
    expect(badgeLabel(10)).toBe("9+");
  });

  it("aria label states the exact unread count", () => {
    expect(bellAriaLabel(0)).toBe("Notifications, none unread");
    expect(bellAriaLabel(12)).toBe("Notifications, 12 unread");
  });

  it("marks only the given unread rows and keeps earlier read times", () => {
    const items = [n("a"), n("b", "2026-10-30T09:00:00Z"), n("c")];
    const next = markRead(items, ["a", "b"], "2026-10-31T12:00:00Z");
    expect(next.map((x) => x.read_at)).toEqual(["2026-10-31T12:00:00Z", "2026-10-30T09:00:00Z", null]);
    expect(unreadIds(next)).toEqual(["c"]);
    expect(items[0].read_at).toBeNull();
  });
});
