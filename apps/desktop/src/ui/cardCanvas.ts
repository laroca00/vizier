// Drawing helpers for the pictures players copy into chats (builds, drafts).

// Open Graph size: Discord and most chats show it whole without cropping.
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export const CARD_COLORS = {
  canvas: "#070f2c",
  surface: "rgba(13, 26, 72, 0.82)",
  glaze: "#eef2ec",
  faint: "rgba(238, 242, 236, 0.6)",
  line: "rgba(238, 242, 236, 0.14)",
  gilt: "#d6b46a",
  ink: "#0b1846",
  blue: "#5b7fe6",
  red: "#e45a48",
};
const FONT = '"Geologica Variable", system-ui, sans-serif';

export type Icon = { src: string; label: string };

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // Data Dragon allows any origin; without this the canvas could not be exported.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export async function drawIcon(ctx: CanvasRenderingContext2D, icon: Icon, x: number, y: number, size: number, radius: number, alpha = 1) {
  const img = await loadImage(icon.src);
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  roundRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.drawImage(img, x, y, size, size);
  ctx.restore();
}

export function drawText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color: string, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

/** A blank card in the app's night blue, fonts loaded. */
export async function newCard(): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = CARD_COLORS.canvas;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  return { canvas, ctx };
}

/** The mark, so a shared picture says where it came from. */
export function drawMark(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = "right";
  drawText(ctx, "Vizier", CARD_WIDTH - 48, CARD_HEIGHT - 44, 26, CARD_COLORS.gilt, 500);
  ctx.textAlign = "start";
}

export function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("empty canvas"))), "image/png"));
}

/** Puts the picture on the clipboard; where that isn't allowed, saves it as a file instead. */
export async function deliverCard(blob: Promise<Blob>, title: string): Promise<"copied" | "saved"> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  } catch {
    const url = URL.createObjectURL(await blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "vizier"}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return "saved";
  }
}
