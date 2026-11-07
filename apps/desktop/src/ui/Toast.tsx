import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { NavIcon } from "./NavIcon";

export type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const SHOWN_FOR = 4500;
// Errors stay longer: they usually come with something to do about them.
const ERROR_SHOWN_FOR = 8000;

const ToastContext = createContext<(kind: ToastKind, message: string) => void>(() => {});

/** Shows a short message in the corner, for results of actions such as an import. */
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((toast) => toast.id !== id)), []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      const id = next.current++;
      // A repeated message replaces the old one instead of stacking.
      setToasts((list) => [...list.filter((toast) => toast.message !== message).slice(-2), { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? ERROR_SHOWN_FOR : SHOWN_FOR);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ol className="toasts" aria-live="polite" aria-label={t("Bildirimler")}>
        {toasts.map((toast) => (
          <li key={toast.id} className="toast" data-kind={toast.kind} role={toast.kind === "error" ? "alert" : "status"}>
            <span className="toast__mark" aria-hidden="true" />
            <span className="toast__message">{toast.message}</span>
            <button type="button" className="toast__close" aria-label={t("Kapat")} onClick={() => dismiss(toast.id)}>
              <NavIcon name="close" size={14} />
            </button>
          </li>
        ))}
      </ol>
    </ToastContext.Provider>
  );
}
