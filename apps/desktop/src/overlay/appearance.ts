import type { CSSProperties } from "react";
import type { WidgetId } from "./registry";

// Look of the overlay boxes: one colour theme for all, and a size and
// opacity per widget on top of the global size.

export type OverlayTheme = "navy" | "ink" | "slate";
export const THEMES: readonly { id: OverlayTheme; name: string; bg: string }[] = [
  { id: "navy", name: "Lacivert", bg: "8 18 54" },
  { id: "ink", name: "Siyah", bg: "6 6 10" },
  { id: "slate", name: "Gri", bg: "32 38 50" },
];

export type WidgetStyle = { scale?: number; opacity?: number };
export type WidgetStyles = Partial<Record<WidgetId, WidgetStyle>>;

export const SCALE_RANGE = { min: 0.7, max: 1.6, step: 0.05 } as const;
/** Multiplies the card's own opacity, so 1 keeps the default look. */
export const OPACITY_RANGE = { min: 0.3, max: 1.25, step: 0.05 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function normalizeStyle(style: WidgetStyle | undefined): Required<WidgetStyle> {
  const scale = Number.isFinite(style?.scale) ? style!.scale! : 1;
  const opacity = Number.isFinite(style?.opacity) ? style!.opacity! : 1;
  return { scale: clamp(scale, SCALE_RANGE.min, SCALE_RANGE.max), opacity: clamp(opacity, OPACITY_RANGE.min, OPACITY_RANGE.max) };
}

export const isDefaultStyle = (style: WidgetStyle | undefined) => {
  const s = normalizeStyle(style);
  return s.scale === 1 && s.opacity === 1;
};

/** Sets or clears one widget's values; a widget back at the defaults leaves no entry. */
export function withWidgetStyle(styles: WidgetStyles, id: WidgetId, patch: WidgetStyle): WidgetStyles {
  const next = normalizeStyle({ ...styles[id], ...patch });
  const { [id]: _drop, ...rest } = styles;
  return isDefaultStyle(next) ? rest : { ...rest, [id]: next };
}

export const themeBg = (theme: OverlayTheme) => (THEMES.find((x) => x.id === theme) ?? THEMES[0]).bg;

/** Variables for the overlay root: the theme colour and the overall opacity. */
export function rootVars(theme: OverlayTheme, scale: number): CSSProperties {
  return { "--overlay-scale": scale, "--overlay-bg": themeBg(theme) } as CSSProperties;
}

/** Variables for one widget's box. */
export function widgetVars(style: WidgetStyle | undefined): CSSProperties {
  const s = normalizeStyle(style);
  return { "--widget-scale": s.scale, "--overlay-alpha": s.opacity } as CSSProperties;
}
