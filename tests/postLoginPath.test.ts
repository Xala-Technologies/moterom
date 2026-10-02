import { describe, expect, it } from "vitest";
import { postLoginPath } from "../src/postLoginPath";

describe("postLoginPath", () => {
  it("sends a member home even when returnTo is an admin URL", () => {
    expect(postLoginPath("/admin", { isAdmin: false })).toBe("/");
    expect(postLoginPath("/admin/users", { isAdmin: false })).toBe("/");
    expect(postLoginPath("/admin?visning=innsikt", { isAdmin: false })).toBe(
      "/",
    );
  });

  it("keeps a booking returnTo for members", () => {
    expect(postLoginPath("/ny-booking?rom=sauda-1", { isAdmin: false })).toBe(
      "/ny-booking?rom=sauda-1",
    );
    expect(postLoginPath("/", { isAdmin: false })).toBe("/");
  });

  it("sends admins to Oversikt from home or any admin returnTo", () => {
    expect(postLoginPath("/", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/admin", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/admin/calendar", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/admin/users", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/admin/messages", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/admin/rooms?q=sauda", { isAdmin: true })).toBe(
      "/admin",
    );
  });

  it("does not land admins on a previous customer inbox or bookings URL", () => {
    expect(postLoginPath("/meldinger", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/mine-bookinger", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/booking/abc123", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/ny-booking?rom=sauda-1", { isAdmin: true })).toBe(
      "/ny-booking?rom=sauda-1",
    );
  });

  it("rejects open redirects", () => {
    expect(postLoginPath("//evil.example", { isAdmin: false })).toBe("/");
    expect(postLoginPath("https://evil.example", { isAdmin: false })).toBe("/");
  });
});
