import { Component, type ErrorInfo, type ReactNode } from "react";
import { useT } from "../i18n";
import { Button } from "./Button";

/** Nothing to show yet: say why and, when there is one, what to do. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {children && <p className="state__text">{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">{message}</p>
      {onRetry && (
        <Button size="small" onClick={onRetry}>
          {t("Tekrar dene")}
        </Button>
      )}
    </div>
  );
}

/** Grey bars in the shape of what is loading; `label` is read out instead of them. */
export function Skeleton({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className="skeleton" role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton__line" style={{ width: `${92 - ((i * 23) % 40)}%` }} />
      ))}
    </div>
  );
}

/** Hover or focus shows `text`; it is also the accessible description. */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="tooltip" data-tip={text} aria-label={text} tabIndex={0}>
      {children}
    </span>
  );
}

type BoundaryProps = { children: ReactNode; fallback: (reset: () => void) => ReactNode };

/** Keeps one broken page from blanking the whole window. */
export class ErrorBoundary extends Component<BoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    return this.state.failed ? this.props.fallback(() => this.setState({ failed: false })) : this.props.children;
  }
}

export function PageCrashed({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="state state--error state--page" role="alert">
      <p className="state__title">{t("Bu sayfa açılırken bir hata oldu.")}</p>
      <p className="state__text">{t("Başka bir sayfaya geçip dönebilir ya da yeniden deneyebilirsin. Hata sürerse Vizier'i yeniden başlat.")}</p>
      <Button size="small" onClick={onReset}>
        {t("Tekrar dene")}
      </Button>
    </div>
  );
}
