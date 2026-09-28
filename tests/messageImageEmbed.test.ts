import { describe, expect, it } from "vitest";
import {
  embedMessageImage,
  extractMessageImage,
  previewWithoutMessageImage,
} from "../shared/messageImageEmbed";

describe("messageImageEmbed", () => {
  it("embeds and extracts a hosted image url", () => {
    const packed = embedMessageImage(
      "Se vedlagt",
      "/message-images/msg-abc.webp",
    );
    expect(packed).toContain("Se vedlagt");
    expect(packed).toContain("[[moterom-image:/message-images/msg-abc.webp]]");
    expect(extractMessageImage(packed)).toEqual({
      content: "Se vedlagt",
      imageUrl: "/message-images/msg-abc.webp",
    });
  });

  it("supports image-only messages", () => {
    const packed = embedMessageImage("", "/message-images/only.jpg");
    expect(extractMessageImage(packed)).toEqual({
      content: "",
      imageUrl: "/message-images/only.jpg",
    });
    expect(previewWithoutMessageImage(packed)).toBe("Bilde");
  });

  it("leaves ordinary text alone", () => {
    expect(extractMessageImage("Hei")).toEqual({ content: "Hei" });
    expect(previewWithoutMessageImage("Hei")).toBe("Hei");
  });

  it("rejects non-hosted image urls", () => {
    expect(() => embedMessageImage("x", "https://evil.example/a.jpg")).toThrow(
      "invalid_message_image_url",
    );
  });
});
