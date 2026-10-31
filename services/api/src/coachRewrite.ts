import type { Coaching } from "./coach.ts";

// Workers AI rewrites the rule findings in plainer Turkish, within the free
// daily allocation. The rewrite is checked against the
// findings and dropped if it changes their facts, so the worst case is the
// rule wording.

export const REWRITE_MODEL = "@cf/google/gemma-4-26b-a4b-it";

const SYSTEM = `Bir League of Legends koçusun. Sana bir oyuncunun maçından çıkarılmış tespitler JSON olarak verilecek. Bu metinler bir kural motorundan geliyor ve kalıp gibi duruyor.

Görevin her tespiti, maçı izlemiş bir koçun oyuncuyla konuşması gibi yeniden yazmak: cümleleri birleştir ya da böl, sırayı değiştir, kalıp ifadeleri at, neden önemli olduğunu ve bir sonraki maçta ne yapacağını net söyle. Metni aynen kopyalama.

Kurallar:
- Her tespiti aynı sırada, aynı sayıda yaz. Yeni tespit ekleme, birini çıkarma.
- Metindeki sayıları, dakikaları ve şampiyon adlarını aynen koru. Metinde olmayan hiçbir sayı, olay ya da öneri ekleme.
- Oyuncuya "sen" diye hitap et. Abartılı övgü ve dolgu cümlesi kullanma.

Örnek giriş: {"title": "Görüş skorun düşük", "detail": "Dakikada 0.5 görüş skoru topladın; bu rol için 1.1 civarı beklenir. 2 totem koydun, 4 totem kırdın."}
Örnek çıkış: {"title": "Haritayı göremiyordun", "detail": "Maç boyunca sadece 2 totem koydun; dakikada 0.5 görüş skoru, bu rolde beklenen 1.1'in yarısı bile değil. Totem kırmakta fena değildin (4 tane), ama kendi görüşünü de kurman lazım: her üsse dönüşte totemini yenile."}

Sadece şu biçimde JSON döndür, başka hiçbir şey yazma:
{"headline": "...", "points": [{"title": "...", "detail": "..."}]}`;

type Ai = { run(model: string, input: unknown): Promise<unknown> };

const numbersIn = (text: string) => new Set(text.match(/\d+(?:[.,]\d+)?/g) ?? []);
// The model sometimes stutters ("hemen hemen hemen"); two in a row can be
// real Turkish, three is a glitch.
const STUTTER = /(?:^|\s)(\S+)(?:\s+\1){2,}(?=\s|$)/iu;

/** Workers AI answers either `{ response }` or, for newer models, an OpenAI-style chat completion. */
function replyText(reply: unknown): unknown {
  if (typeof reply !== "object" || reply === null) return reply;
  if ("response" in reply) return (reply as { response: unknown }).response;
  const choices = (reply as { choices?: { message?: { content?: unknown } }[] }).choices;
  return choices?.[0]?.message?.content ?? null;
}

function parseReply(reply: unknown): { headline?: unknown; points?: unknown } | null {
  const text = replyText(reply);
  if (typeof text === "object" && text !== null) return text as { headline?: unknown; points?: unknown };
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Returns the rewrite only if it keeps every finding and adds no numbers. */
export function acceptRewrite(original: Coaching, reply: unknown): Coaching | null {
  const parsed = parseReply(reply);
  if (!parsed || typeof parsed.headline !== "string" || !Array.isArray(parsed.points)) return null;
  if (parsed.points.length !== original.points.length) return null;

  const points: Coaching["points"] = [];
  for (const [i, point] of (parsed.points as { title?: unknown; detail?: unknown }[]).entries()) {
    const source = original.points[i];
    if (typeof point?.title !== "string" || typeof point?.detail !== "string") return null;
    if (!point.title.trim() || !point.detail.trim() || point.detail.length > 700) return null;
    if (STUTTER.test(point.title) || STUTTER.test(point.detail)) return null;
    const allowed = numbersIn(`${source.title} ${source.detail}`);
    for (const n of numbersIn(`${point.title} ${point.detail}`)) if (!allowed.has(n)) return null;
    points.push({ minute: source.minute, title: point.title.trim(), detail: point.detail.trim() });
  }
  const headlineAllowed = numbersIn(original.headline);
  for (const n of numbersIn(parsed.headline)) if (!headlineAllowed.has(n)) return null;
  return { headline: parsed.headline.trim(), points };
}

export async function rewriteWithWorkersAi(ai: Ai, coaching: Coaching): Promise<Coaching | null> {
  if (coaching.points.length === 0) return null;
  const input = {
    headline: coaching.headline,
    points: coaching.points.map(({ title, detail }) => ({ title, detail })),
  };
  try {
    const reply = await ai.run(REWRITE_MODEL, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(input) },
      ],
      // The model reasons before answering and the reasoning counts against
      // max_tokens; with too little room the answer comes back empty.
      max_tokens: 4000,
      chat_template_kwargs: { enable_thinking: false },
    });
    const accepted = acceptRewrite(coaching, reply);
    if (!accepted) console.warn("coach rewrite rejected:", JSON.stringify(reply).slice(0, 800));
    return accepted;
  } catch (error) {
    // Out of free allocation or model unavailable: the rule text stands.
    console.error("coach rewrite failed:", error);
    return null;
  }
}
