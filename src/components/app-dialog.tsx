"use client";

import { useEffect, useId, useRef } from "react";

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [] as HTMLElement[];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function AppDialog(props: {
  children: React.ReactNode;
  closeLabel?: string;
  onClose: () => void;
  title: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(props.onClose);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = props.onClose;
  }, [props.onClose]);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusables = getFocusableElements(dialogRef.current);
    const firstTarget = focusables[0] ?? dialogRef.current;
    firstTarget?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const items = getFocusableElements(dialogRef.current);
      if (items.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;

      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, []);

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 grid place-items-center bg-black/20 p-4 duration-300">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="glass-card animate-in zoom-in-95 relative max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-[var(--radius-lg)] p-6 duration-300 md:p-8"
      >
        <div className="absolute top-0 left-0 h-2 w-full bg-[var(--color-primary)]"></div>
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2
            id={titleId}
            className="text-3xl font-[var(--font-title)] text-[var(--color-text-main)]"
          >
            {props.title}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            className="btn-secondary rounded-full px-4 py-2 text-sm font-bold"
          >
            {props.closeLabel ?? "Close"}
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}
