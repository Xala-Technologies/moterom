import type { Message } from "./types";

function withoutReadReceipt(message: Message): Message {
  const { readByPeer: _ignored, ...rest } = message;
  void _ignored;
  return rest;
}

/**
 * Marks the viewer's own messages as read by the peer using the peer's
 * unread counter: the newest `peerUnread` own messages stay unread; older
 * ones are read. Peer messages are left without `readByPeer`.
 */
export function annotateMessagesWithReadReceipts(
  messages: Message[],
  peerUnread: number,
  viewerIsAdmin: boolean,
): Message[] {
  let remaining = Math.max(0, Math.floor(peerUnread));
  const annotated = messages.map((message) => withoutReadReceipt(message));
  for (let index = annotated.length - 1; index >= 0; index -= 1) {
    const message = annotated[index]!;
    if (message.fromAdmin !== viewerIsAdmin) continue;
    if (remaining > 0) {
      annotated[index] = { ...message, readByPeer: false };
      remaining -= 1;
    } else {
      annotated[index] = { ...message, readByPeer: true };
    }
  }
  return annotated;
}
