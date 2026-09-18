import { describe, expect, it } from "vitest";
import { presentBuildingMembers } from "../shared/members";
import type { TenantMember } from "../shared/types";

const row = (
  patch: Partial<TenantMember> & Pick<TenantMember, "userId" | "email">,
): TenantMember => ({
  name: patch.name ?? patch.email,
  role: "support",
  status: "active",
  ...patch,
});

describe("presentBuildingMembers", () => {
  it("hides Digilist fixture accounts and duplicate emails", () => {
    const presented = presentBuildingMembers([
      row({
        userId: "dev-admin",
        name: "SKB DEV Admin",
        email: "skb.admin@digilist.dev",
        role: "tenant_admin",
      }),
      row({
        userId: "dev-member",
        name: "SKB DEV Member",
        email: "skb.member@digilist.dev",
      }),
      row({
        userId: "dup-invited",
        name: "LIJSERIBST",
        email: "BurnerLBV12@gmail.com",
        status: "invited",
      }),
      row({
        userId: "dup-active",
        name: "LIJSERIBST",
        email: "burnerlbv12@gmail.com",
      }),
      row({
        userId: "admin",
        name: "SKB allowlist admin",
        email: "skb@digilist.no",
        role: "tenant_admin",
      }),
      row({
        userId: "booker",
        name: "Wahid Rahmani",
        email: "wahidullah_rahmani@hotmail.com",
      }),
    ]);
    expect(presented.map((member) => member.email)).toEqual([
      "skb@digilist.no",
      "burnerlbv12@gmail.com",
      "wahidullah_rahmani@hotmail.com",
    ]);
    expect(
      presented.find((member) => member.email.startsWith("burner"))?.userId,
    ).toBe("dup-active");
  });
});
