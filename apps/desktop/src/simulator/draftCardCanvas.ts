import { CARD_COLORS as C, CARD_HEIGHT, CARD_WIDTH, deliverCard, drawIcon, drawMark, drawText, newCard, roundRect, toPng } from "../ui/cardCanvas";
import type { DraftCardContent, DraftCardTeam } from "./draftCard";

const ROW = 78;
const TOP = 132;
const ICON = 62;

async function drawTeam(ctx: CanvasRenderingContext2D, team: DraftCardTeam, side: "blue" | "red", label: string) {
  const right = side === "red";
  const edge = right ? CARD_WIDTH - 64 : 64;
  const colour = right ? C.red : C.blue;
  ctx.textAlign = right ? "right" : "left";
  drawText(ctx, label, edge, TOP - 24, 20, colour, 600);
  if (team.plan) {
    const width = ctx.measureText(label).width;
    drawText(ctx, team.plan, right ? edge - width - 16 : edge + width + 16, TOP - 24, 18, C.faint, 500);
  }
  for (const [i, pick] of team.picks.entries()) {
    const y = TOP + i * ROW;
    const ix = right ? edge - ICON : edge;
    if (pick.icon) {
      await drawIcon(ctx, { src: pick.icon, label: pick.name }, ix, y, ICON, 14);
      ctx.strokeStyle = colour;
      ctx.lineWidth = 2;
      roundRect(ctx, ix - 1, y - 1, ICON + 2, ICON + 2, 15);
      ctx.stroke();
    } else {
      ctx.fillStyle = C.surface;
      roundRect(ctx, ix, y, ICON, ICON, 14);
      ctx.fill();
    }
    ctx.textAlign = right ? "right" : "left";
    drawText(ctx, pick.name, right ? ix - 18 : ix + ICON + 18, y + ICON / 2 + 8, 24, C.glaze, 400);
  }
  ctx.textAlign = "start";
}

/** Draws the draft picture: blue on the left, red on the right, bans along the bottom. */
export async function renderDraftCard(content: DraftCardContent, labels: { blue: string; red: string; bans: string }): Promise<Blob> {
  const { canvas, ctx } = await newCard();

  // A thin wash of each side's colour behind its column.
  const wash = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
  wash.addColorStop(0, "rgba(91, 127, 230, 0.16)");
  wash.addColorStop(0.42, "rgba(91, 127, 230, 0)");
  wash.addColorStop(0.58, "rgba(228, 90, 72, 0)");
  wash.addColorStop(1, "rgba(228, 90, 72, 0.16)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.textAlign = "center";
  drawText(ctx, content.title, CARD_WIDTH / 2, 64, 30, C.glaze, 350);
  drawText(ctx, "VS", CARD_WIDTH / 2, TOP + 2 * ROW + ICON / 2 + 12, 34, C.gilt, 600);
  ctx.textAlign = "start";

  await drawTeam(ctx, content.blue, "blue", labels.blue);
  await drawTeam(ctx, content.red, "red", labels.red);

  if (content.bans.length > 0) {
    const y = CARD_HEIGHT - 76;
    drawText(ctx, labels.bans, 64, y + 26, 18, C.faint, 500);
    let x = 64 + ctx.measureText(labels.bans).width + 18;
    for (const ban of content.bans.slice(0, 10)) {
      await drawIcon(ctx, { src: ban.icon, label: ban.name }, x, y, 38, 9, 0.55);
      x += 44;
    }
  }

  drawMark(ctx);
  return toPng(canvas);
}

export const copyDraftCard = (content: DraftCardContent, labels: { blue: string; red: string; bans: string }) =>
  deliverCard(renderDraftCard(content, labels), content.title);
