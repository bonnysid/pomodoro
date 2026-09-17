import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { IconButton } from './IconButton';
export function Modal({
  title,
  close,
  closeLabel,
  children,
}: {
  title: string;
  close: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={close}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-inner">
        <header className="modal-header">
          <h1 id="modal-title">{title}</h1>
          <IconButton label={closeLabel} onClick={close}>
            <X size={18} />
          </IconButton>
        </header>
        <div className="modal-content">{children}</div>
      </div>
    </dialog>
  );
}
