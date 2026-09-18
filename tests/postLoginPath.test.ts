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

  it("sends admins to administration from the home returnTo", () => {
    expect(postLoginPath("/", { isAdmin: true })).toBe("/admin");
    expect(postLoginPath("/admin/calendar", { isAdmin: true })).toBe(
      "/admin/calendar",
    );
  });

  it("rejects open redirects", () => {
    expect(postLoginPath("//evil.example", { isAdmin: false })).toBe("/");
    expect(postLoginPath("https://evil.example", { isAdmin: false })).toBe("/");
  });
});
