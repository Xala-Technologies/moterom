/** Embed Møterom-hosted chat images in Digilist text messages until Digilist stores attachments. */

const MARKER_RE =
  /(?:\n\n)?\[\[moterom-image:(\/message-images\/[A-Za-z0-9._-]+)\]\]\s*$/;

export function embedMessageImage(content: string, imageUrl: string): string {
  if (!/^\/message-images\/[A-Za-z0-9._-]+$/.test(imageUrl)) {
    throw new Error("invalid_message_image_url");
  }
  const text = content.trim();
  const marker = `[[moterom-image:${imageUrl}]]`;
  return text ? `${text}\n\n${marker}` : marker;
}

export function extractMessageImage(content: string): {
  content: string;
  imageUrl?: string;
} {
  const match = content.match(MARKER_RE);
  if (!match) return { content };
  return {
    content: content.slice(0, match.index).trimEnd(),
    imageUrl: match[1],
  };
}

/** Inbox preview without the machine marker; image-only → "Bilde". */
export function previewWithoutMessageImage(
  preview: string,
  imageLabel = "Bilde",
): string {
  const { content, imageUrl } = extractMessageImage(preview);
  if (content) return content;
  return imageUrl ? imageLabel : preview;
}
