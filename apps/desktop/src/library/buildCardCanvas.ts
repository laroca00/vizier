import { CARD_COLORS as C, CARD_HEIGHT, CARD_WIDTH, deliverCard, drawIcon, drawMark, drawText as text, loadImage, newCard, roundRect, toPng } from "../ui/cardCanvas";
import type { CardContent } from "./buildCard";

/** Draws the build picture and returns it as a PNG. */
export async function renderBuildCard(content: CardContent): Promise<Blob> {
  const { canvas, ctx } = await newCard();

  // Splash art on the right, faded into the night blue where the text sits.
  const splash = content.splash ? await loadImage(content.splash) : null;
  if (splash) {
    const h = CARD_HEIGHT;
    const w = (splash.width / splash.height) * h;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(splash, CARD_WIDTH - w + w * 0.18, 0, w, h);
    ctx.globalAlpha = 1;
    const fade = ctx.createLinearGradient(380, 0, 900, 0);
    fade.addColorStop(0, C.canvas);
    fade.addColorStop(1, "rgba(7, 15, 44, 0)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  const left = 64;
  // Portrait with the client's gold edge, then the name.
  if (content.portrait) {
    await drawIcon(ctx, { src: content.portrait, label: "" }, left, 56, 96, 20);
    ctx.strokeStyle = C.gilt;
    ctx.lineWidth = 2;
    roundRect(ctx, left - 1, 55, 98, 98, 21);
    ctx.stroke();
  }
  text(ctx, content.title, left + 124, 106, 42, C.glaze, 350);
  text(ctx, content.subtitle, left + 126, 140, 22, C.faint);

  // Runes and spells on one band.
  let x = left;
  const runeY = 196;
  if (content.keystone) {
    await drawIcon(ctx, content.keystone, x, runeY, 72, 36);
    x += 84;
  }
  for (const r of content.primary) {
    await drawIcon(ctx, r, x, runeY + 14, 44, 22);
    x += 52;
  }
  if (content.secondary.length > 0) {
    ctx.fillStyle = C.line;
    ctx.fillRect(x + 6, runeY + 10, 1, 52);
    x += 20;
    for (const r of content.secondary) {
      await drawIcon(ctx, r, x, runeY + 16, 40, 20);
      x += 48;
    }
  }
  if (content.spells.length > 0) {
    x += 24;
    for (const s of content.spells) {
      await drawIcon(ctx, s, x, runeY + 12, 48, 10);
      x += 56;
    }
  }

  // Item rows: the label in a narrow column, the icons beside it; the core row a step larger.
  let y = 300;
  for (const row of content.rows) {
    const size = row.main ? 60 : 52;
    text(ctx, row.label, left, y + size / 2 + 6, 18, C.faint, 500);
    let ix = left + 128;
    for (const item of row.items.slice(0, 8)) {
      await drawIcon(ctx, item, ix, y, size, 10);
      ix += size + 10;
    }
    y += size + 14;
  }

  // Skill order in gilt keys, bottom left.
  if (content.skills) {
    const keys = content.skills.split(" > ");
    let kx = left;
    const ky = CARD_HEIGHT - 76;
    for (const [i, key] of keys.entries()) {
      ctx.fillStyle = i === 0 ? C.gilt : C.surface;
      roundRect(ctx, kx, ky, 40, 40, 10);
      ctx.fill();
      ctx.textAlign = "center";
      text(ctx, key, kx + 20, ky + 27, 20, i === 0 ? C.ink : C.glaze, 600);
      ctx.textAlign = "start";
      kx += 40;
      if (i < keys.length - 1) {
        text(ctx, "›", kx + 8, ky + 28, 24, C.faint);
        kx += 28;
      }
    }
  }

  drawMark(ctx);
  return toPng(canvas);
}

export const copyBuildCard = (content: CardContent) => deliverCard(renderBuildCard(content), content.title);
