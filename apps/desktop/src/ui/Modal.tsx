import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n";
import { Button, IconButton } from "./Button";
import { NavIcon } from "./NavIcon";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Buttons along the bottom, primary last. */
  actions?: ReactNode;
  /** For forms that need room; the body scrolls inside the window. */
  wide?: boolean;
};

/** A native dialog: focus is trapped and Escape closes it without any code of ours. */
export function Modal({ open, title, onClose, children, actions, wide = false }: Props) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className={wide ? "modal modal--wide" : "modal"}
      aria-label={title}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
    >
      <div className="modal__box">
        <header className="modal__head">
          <h2 className="modal__title">{title}</h2>
          <IconButton label={t("Kapat")} onClick={onClose}>
            <NavIcon name="close" size={16} />
          </IconButton>
        </header>
        <div className="modal__body">{children}</div>
        {actions && <footer className="modal__actions">{actions}</footer>}
      </div>
    </dialog>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  /** A destructive action gets the danger colour. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, message, confirmLabel, danger = false, onConfirm, onCancel }: ConfirmProps) {
  const t = useT();
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {t("Vazgeç")}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="modal__message">{message}</p>
    </Modal>
  );
}
