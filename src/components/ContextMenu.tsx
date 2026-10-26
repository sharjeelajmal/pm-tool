"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export interface ContextMenuItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

interface ContextMenuProps {
  // Viewport point the menu opens at; null closes it.
  position: { x: number; y: number } | null;
  items: ContextMenuItem[];
  title?: React.ReactNode;
  // Must be stable (useCallback) — it's an effect dependency.
  onClose: () => void;
  // Button that also opens/closes the menu; clicks on it are not treated as "outside".
  toggleRef?: React.RefObject<HTMLElement | null>;
}

const EDGE = 8;
const subscribeNoop = () => () => {};

export function ContextMenu({ position, items, title, onClose, toggleRef }: ContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const isClient = React.useSyncExternalStore(subscribeNoop, () => true, () => false);

  // Keep the menu on screen: shift it left near the right edge and open upwards near the bottom.
  React.useLayoutEffect(() => {
    const el = menuRef.current;
    if (!position || !el) return;
    const { width, height } = el.getBoundingClientRect();
    const flip = position.y + height > window.innerHeight - EDGE;
    el.style.left = `${Math.max(EDGE, Math.min(position.x, window.innerWidth - width - EDGE))}px`;
    el.style.top = `${flip ? Math.max(EDGE, position.y - height) : position.y}px`;
    el.style.transformOrigin = flip ? "bottom left" : "top left";
  }, [position]);

  React.useEffect(() => {
    if (!position) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      // The button that opened the menu toggles it itself.
      if (menuRef.current?.contains(target) || toggleRef?.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    window.addEventListener("blur", onClose);
    menuRef.current?.querySelector<HTMLButtonElement>("[role=menuitem]:not(:disabled)")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [position, onClose, toggleRef]);

  const moveFocus = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") return onClose();
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)"));
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? buttons.length - 1
      : e.key === "ArrowDown" ? (current + 1) % buttons.length
      : (current - 1 + buttons.length) % buttons.length;
    buttons[next].focus();
  };

  if (!isClient) return null;

  return createPortal(
    <AnimatePresence>
      {position && (
        <motion.div
          ref={menuRef}
          role="menu"
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ left: position.x, top: position.y }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onKeyDown={moveFocus}
          className="fixed z-[1000] min-w-[210px] max-w-[calc(100vw-16px)] py-1.5 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-xl shadow-xl shadow-slate-300/40 dark:shadow-black/50 select-none"
        >
          {title && (
            <div className="px-3 pt-1 pb-2 mb-1 border-b border-slate-100 dark:border-white/5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {title}
            </div>
          )}
          {items.map((item) => (
            <React.Fragment key={item.key}>
              {item.separatorBefore && <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  onClose();
                  item.onSelect();
                }}
                className={`w-[calc(100%-8px)] mx-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-left outline-none transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  item.danger
                    ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 focus-visible:bg-rose-50 dark:hover:bg-rose-500/10 dark:focus-visible:bg-rose-500/10"
                    : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 focus-visible:bg-slate-100/80 dark:hover:bg-white/5 dark:focus-visible:bg-white/5"
                }`}
              >
                {item.icon && (
                  <span className={`shrink-0 ${item.danger ? "" : "text-slate-400 dark:text-slate-500"}`}>{item.icon}</span>
                )}
                <span className="flex-1 truncate">{item.label}</span>
                {item.hint && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {item.hint}
                  </span>
                )}
              </button>
            </React.Fragment>
          ))}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
