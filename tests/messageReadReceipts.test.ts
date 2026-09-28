import { describe, expect, it } from "vitest";
import { annotateMessagesWithReadReceipts } from "../shared/messageReadReceipts";
import type { Message } from "../shared/types";

function msg(id: string, fromAdmin: boolean, createdAt: number): Message {
  return {
    id,
    conversationId: "c1",
    senderId: fromAdmin ? "admin" : "customer",
    senderName: fromAdmin ? "Administrator" : "Kari",
    fromAdmin,
    content: id,
    createdAt,
  };
}

describe("annotateMessagesWithReadReceipts", () => {
  it("marks older own messages read when peer still has newer unread", () => {
    const messages = [
      msg("c1", false, 1),
      msg("a1", true, 2),
      msg("a2", true, 3),
      msg("a3", true, 4),
    ];
    const annotated = annotateMessagesWithReadReceipts(messages, 2, true);
    expect(annotated.find((m) => m.id === "a1")?.readByPeer).toBe(true);
    expect(annotated.find((m) => m.id === "a2")?.readByPeer).toBe(false);
    expect(annotated.find((m) => m.id === "a3")?.readByPeer).toBe(false);
    expect(annotated.find((m) => m.id === "c1")?.readByPeer).toBeUndefined();
  });

  it("marks all own messages read when peer unread is zero", () => {
    const messages = [msg("a1", true, 1), msg("c1", false, 2)];
    const annotated = annotateMessagesWithReadReceipts(messages, 0, true);
    expect(annotated.find((m) => m.id === "a1")?.readByPeer).toBe(true);
  });
});
