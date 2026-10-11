"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, animate, motion, type HTMLMotionProps } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Check, ChevronDown, CircleCheck, CircleX, Info, Loader2, Search, X, type LucideIcon } from "lucide-react";
import { initials } from "@/lib/crm/types";
import { color, userColor, type ColorName } from "@/components/crm/theme";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const noopSubscribe = () => () => {};

// False during SSR/hydration, true on the client: gates portals to document.body.
export function useMounted() {
  return React.useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export const SPRING = { type: "spring", stiffness: 420, damping: 34 } as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* ------------------------------------------------------------------ */
/* Buttons                                                            */
/* ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  primary:
    "text-white bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 shadow-[0_8px_20px_-8px_rgba(37,99,235,0.7)] ring-1 ring-inset ring-white/15",
  secondary:
    "bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-white/[0.07] shadow-sm",
  ghost: "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10",
  danger: "text-white bg-gradient-to-b from-rose-500 to-rose-600 hover:to-rose-700 shadow-[0_8px_20px_-8px_rgba(225,29,72,0.7)]",
  soft: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20",
  success: "text-white bg-gradient-to-b from-emerald-500 to-emerald-600 hover:to-emerald-700 shadow-[0_8px_20px_-8px_rgba(5,150,105,0.7)]",
} as const;

const BUTTON_SIZES = {
  xs: "h-7 px-2.5 text-[11px] rounded-lg",
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
} as const;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  loading?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold cursor-pointer whitespace-nowrap select-none",
        "transition-[transform,background-color,border-color,box-shadow,color] duration-200 active:scale-[0.97] hover:-translate-y-px active:translate-y-0",
        "disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5 shrink-0" /> : null}
      {children}
    </button>
  );
});

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
  size?: "sm" | "md";
  tone?: "default" | "danger";
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, size = "sm", tone = "default", className, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center justify-center rounded-lg cursor-pointer shrink-0 transition-all duration-200 active:scale-90 disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" ? "w-8 h-8" : "w-10 h-10",
        tone === "danger"
          ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-white/10",
        className
      )}
      {...props}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
});

/* ------------------------------------------------------------------ */
/* Form controls                                                      */
/* ------------------------------------------------------------------ */

export const controlClass =
  "w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120]/60 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 transition-[border-color,box-shadow,background-color] duration-200 hover:border-slate-300 dark:hover:border-white/20 disabled:opacity-60";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref
) {
  return <input ref={ref} className={cn(controlClass, "h-10 px-3", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(controlClass, "px-3 py-2.5 min-h-[88px] resize-y", className)} {...props} />;
  }
);

export function Field({
  label,
  hint,
  className,
  children,
  required,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  indeterminate,
  label,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  label?: string;
  className?: string;
}) {
  const state = checked ? "on" : indeterminate ? "mixed" : "off";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate && !checked ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        "relative w-[18px] h-[18px] rounded-[6px] border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 active:scale-90",
        state === "off"
          ? "border-slate-300 dark:border-white/20 bg-white dark:bg-transparent hover:border-blue-400"
          : "border-blue-600 bg-blue-600 shadow-[0_4px_10px_-4px_rgba(37,99,235,0.8)]",
        className
      )}
    >
      <AnimatePresence initial={false}>
        {state === "on" && (
          <motion.svg key="c" viewBox="0 0 12 12" className="w-2.5 h-2.5 text-white" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}>
            <motion.path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25 }} />
          </motion.svg>
        )}
        {state === "mixed" && <motion.span key="m" className="w-2 h-0.5 rounded bg-white" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }} />}
      </AnimatePresence>
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 cursor-pointer",
        checked ? "bg-gradient-to-r from-blue-500 to-indigo-500 justify-end" : "bg-slate-300 dark:bg-white/15 justify-start"
      )}
    >
      <motion.span layout transition={SPRING} className="h-5 w-5 rounded-full bg-white shadow-md" />
    </button>
  );
}

// Tabs with a sliding pill behind the active option.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: LucideIcon; count?: number }[];
  size?: "sm" | "md";
  className?: string;
}) {
  const id = React.useId();
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-xl bg-slate-100/90 dark:bg-white/[0.04] p-1 border border-slate-200/70 dark:border-white/[0.06]",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-lg font-semibold cursor-pointer whitespace-nowrap transition-colors duration-200",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
              active ? "text-slate-900 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={SPRING}
                className="absolute inset-0 rounded-lg bg-white dark:bg-[#1E293B] shadow-[0_1px_2px_rgba(15,23,42,0.08),0_4px_12px_-6px_rgba(15,23,42,0.2)] ring-1 ring-slate-200/60 dark:ring-white/10"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {opt.label}
              {opt.count !== undefined && (
                <span className={cn("text-[10px] tabular-nums", active ? "text-blue-600 dark:text-blue-400" : "text-slate-400")}>{opt.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Colored option buttons where the active highlight slides between choices.
export function ChoiceChips<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; colorName: ColorName | string; icon?: LucideIcon }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = React.useId();
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        const c = color(opt.colorName);
        const Icon = opt.icon;
        return (
          <motion.button
            key={opt.value}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative inline-flex items-center justify-center gap-1.5 rounded-xl border font-bold cursor-pointer transition-colors duration-200",
              size === "sm" ? "h-8 px-3 text-[11px]" : "h-9 px-3.5 text-xs",
              active ? "border-transparent" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
            )}
          >
            {active && <motion.span layoutId={`choice-${id}`} transition={SPRING} className={cn("absolute inset-0 rounded-xl ring-1 ring-inset", c.soft)} />}
            <span className="relative inline-flex items-center gap-1.5">
              {active ? (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING}>
                  {Icon ? <Icon className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                </motion.span>
              ) : (
                <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />
              )}
              <span className={cn(active && c.text)}>{opt.label}</span>
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Display                                                            */
/* ------------------------------------------------------------------ */

export function Badge({
  color: name = "slate",
  children,
  dot,
  className,
}: {
  color?: ColorName | string;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const c = color(name);
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap", c.soft, className)}>
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full", c.dot)} />}
      {children}
    </span>
  );
}

const AVATAR_GRADIENTS: Record<string, string> = {
  slate: "from-slate-400 to-slate-500",
  blue: "from-blue-500 to-indigo-500",
  sky: "from-sky-400 to-blue-500",
  indigo: "from-indigo-500 to-violet-500",
  violet: "from-violet-500 to-fuchsia-500",
  pink: "from-pink-500 to-rose-500",
  rose: "from-rose-500 to-orange-500",
  orange: "from-orange-500 to-amber-500",
  amber: "from-amber-400 to-orange-500",
  lime: "from-lime-400 to-emerald-500",
  emerald: "from-emerald-400 to-teal-500",
  teal: "from-teal-400 to-cyan-500",
  cyan: "from-cyan-400 to-blue-500",
};

export function Avatar({
  name,
  size = "sm",
  colorName,
  className,
  title,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  colorName?: ColorName;
  className?: string;
  title?: string;
}) {
  const key = colorName || userColor(name);
  const sizes = { xs: "w-5 h-5 text-[8px]", sm: "w-7 h-7 text-[10px]", md: "w-9 h-9 text-xs", lg: "w-16 h-16 text-xl" };
  return (
    <span
      title={title ?? name}
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white shrink-0 bg-gradient-to-br shadow-sm ring-2 ring-white/70 dark:ring-white/10",
        AVATAR_GRADIENTS[key] || AVATAR_GRADIENTS.blue,
        sizes[size],
        className
      )}
    >
      {initials(name)}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("w-5 h-5 animate-spin text-blue-600", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("crm-shimmer rounded-lg bg-slate-200/70 dark:bg-white/[0.06]", className)} />;
}

// Smoothly tweens between values (count-up on first render).
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(0);
  const from = React.useRef(0);
  React.useEffect(() => {
    const controls = animate(from.current, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => setDisplay(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration]);
  return <span className={cn("tabular-nums", className)}>{format(display)}</span>;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE_OUT }}
      className={cn("flex flex-col items-center justify-center text-center py-14 px-6", className)}
    >
      <div className="relative w-24 h-24 mb-5">
        <span className="absolute inset-0 rounded-full bg-blue-500/10 animate-ping [animation-duration:3s]" />
        <span className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/15" />
        <span className="absolute inset-5 rounded-2xl rotate-12 bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_12px_30px_-10px_rgba(37,99,235,0.8)]" />
        <span className="absolute inset-5 rounded-2xl flex items-center justify-center">
          <Icon className="w-7 h-7 text-white" />
        </span>
        <span className="absolute -right-1 top-3 w-3 h-3 rounded-full bg-amber-400 crm-float" />
        <span className="absolute left-0 bottom-3 w-2 h-2 rounded-full bg-emerald-400 crm-float [animation-delay:-5s]" />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-white">{title}</h3>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </motion.div>
  );
}

export function Card({ className, children, hover, ...props }: HTMLMotionProps<"div"> & { hover?: boolean }) {
  return (
    <motion.div
      {...props}
      className={cn(
        "rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-sm shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.14)] dark:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.6)]",
        hover && "transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(37,99,235,0.35)] hover:border-blue-200 dark:hover:border-blue-500/30",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

// Horizontal scroller that also works with a mouse: arrow buttons, drag-to-scroll,
// optional vertical-wheel → horizontal, and edge fades that only show where there's more.
export function HScroll({
  children,
  className,
  innerClassName,
  arrows = true,
  wheel = true,
  drag = true,
  ignoreDragFrom,
  step = 0.8,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  arrows?: boolean;
  wheel?: boolean;
  drag?: boolean;
  ignoreDragFrom?: string;
  step?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ left: false, right: false });
  const dragState = React.useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const update = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    el.addEventListener("scroll", update, { passive: true });
    // Mouse wheels only scroll vertically; turn that into sideways scrolling while there's room.
    const onWheel = (e: WheelEvent) => {
      if (!wheel || Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) return;
      const canLeft = el.scrollLeft > 0;
      const canRight = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      if ((e.deltaY < 0 && canLeft) || (e.deltaY > 0 && canRight)) {
        e.preventDefault();
        el.scrollBy({ left: e.deltaY, behavior: "auto" });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", update);
      el.removeEventListener("wheel", onWheel);
    };
  }, [update, wheel]);

  // Arrow buttons sit next to the scroll container inside the same wrapper.
  const scrollByPage = (e: React.MouseEvent<HTMLElement>, dir: number) => {
    const el = e.currentTarget.parentElement?.firstElementChild as HTMLElement | null;
    if (el) el.scrollBy({ left: dir * el.clientWidth * step, behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drag || e.pointerType !== "mouse" || e.button !== 0) return;
    if (ignoreDragFrom && (e.target as HTMLElement).closest(ignoreDragFrom)) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
    dragState.current = { x: e.clientX, left: ref.current?.scrollLeft || 0, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragState.current;
    const el = ref.current;
    if (!s || !el) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) > 6) {
      s.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (s.moved) el.scrollLeft = s.left - dx;
  };
  const endDrag = (e: React.PointerEvent) => {
    const s = dragState.current;
    dragState.current = null;
    if (s?.moved) {
      ref.current?.releasePointerCapture(e.pointerId);
      // Swallow the click that follows a drag so cards don't open.
      const stop = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener("click", stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
    }
  };

  const mask =
    edges.left && edges.right
      ? "[mask-image:linear-gradient(to_right,transparent,black_40px,black_calc(100%-40px),transparent)]"
      : edges.right
      ? "[mask-image:linear-gradient(to_right,black_calc(100%-48px),transparent)]"
      : edges.left
      ? "[mask-image:linear-gradient(to_right,transparent,black_48px)]"
      : "";

  return (
    <div className={cn("relative group/hs min-w-0", className)}>
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn("overflow-x-auto no-scrollbar overscroll-x-contain", drag && "md:cursor-grab md:active:cursor-grabbing", mask)}
      >
        <div className={cn("flex w-max min-w-full", innerClassName)}>{children}</div>
      </div>
      {arrows &&
        ([-1, 1] as const).map((dir) => {
          const show = dir < 0 ? edges.left : edges.right;
          return (
            <AnimatePresence key={dir}>
              {show && (
                <motion.button
                  type="button"
                  aria-label={dir < 0 ? "Scroll left" : "Scroll right"}
                  initial={{ opacity: 0, scale: 0.8, y: "-50%" }}
                  animate={{ opacity: 1, scale: 1, y: "-50%" }}
                  exit={{ opacity: 0, scale: 0.8, y: "-50%" }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => scrollByPage(e, dir)}
                  className={cn(
                    "hidden md:flex absolute top-1/2 z-20 w-9 h-9 rounded-full items-center justify-center cursor-pointer",
                    "bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-200",
                    "shadow-[0_8px_20px_-8px_rgba(15,23,42,0.45)] hover:text-blue-600 hover:border-blue-300 transition-colors",
                    dir < 0 ? "left-1" : "right-1"
                  )}
                >
                  <ChevronDown className={cn("w-4 h-4", dir < 0 ? "rotate-90" : "-rotate-90")} />
                </motion.button>
              )}
            </AnimatePresence>
          );
        })}
    </div>
  );
}

// Stagger helpers for lists.
export const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};
export const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
};

/* ------------------------------------------------------------------ */
/* Anchored overlays                                                  */
/* ------------------------------------------------------------------ */

function useEscape(open: boolean, onClose: () => void) {
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);
}

type Placement = { top: number; left: number; width: number; maxHeight: number; above: boolean };

// Positions a portal panel next to its trigger, flipping above when there's no room below.
function useAnchor(open: boolean, close: () => void, opts: { align: "start" | "end"; width?: number; matchWidth?: boolean }) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = React.useState<Placement | null>(null);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = opts.matchWidth ? Math.max(rect.width, opts.width || 0) : opts.width || 220;
    const panelHeight = panelRef.current?.offsetHeight || 0;
    const margin = 8;
    let left = opts.align === "end" ? rect.right - width : rect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const above = panelHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(180, (above ? spaceAbove : spaceBelow) - 8);
    const top = above ? Math.max(margin, rect.top - 6 - Math.min(panelHeight, maxHeight)) : rect.bottom + 6;
    setPlacement({ top, left, width, maxHeight, above });
  }, [open, opts.align, opts.width, opts.matchWidth]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, close]);

  return { triggerRef, panelRef, placement };
}

const panelClass =
  "fixed z-[140] overflow-y-auto rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/95 dark:bg-[#131c31]/95 backdrop-blur-xl shadow-[0_24px_48px_-16px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.7)] font-sans";

function AnchoredPanel({
  open,
  placement,
  panelRef,
  className,
  children,
}: {
  open: boolean;
  placement: Placement | null;
  panelRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, scale: 0.96, y: placement?.above ? 6 : -6 }}
          animate={{ opacity: placement ? 1 : 0, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: placement?.above ? 4 : -4, transition: { duration: 0.12 } }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          style={{
            top: placement?.top ?? -9999,
            left: placement?.left ?? -9999,
            width: placement?.width,
            maxHeight: placement?.maxHeight,
            transformOrigin: placement?.above ? "bottom center" : "top center",
          }}
          onClick={(e) => e.stopPropagation()}
          className={cn(panelClass, className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

type TriggerProps = { ref: React.Ref<HTMLButtonElement>; onClick: (e: React.MouseEvent) => void; "aria-expanded": boolean };

export function Popover({
  trigger,
  children,
  align = "start",
  width = 220,
  className,
}: {
  trigger: (props: TriggerProps) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  width?: number;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const { triggerRef, panelRef, placement } = useAnchor(open, close, { align, width });
  useEscape(open, close);

  return (
    <>
      {trigger({
        ref: triggerRef,
        "aria-expanded": open,
        onClick: (e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        },
      })}
      <AnchoredPanel open={open} placement={placement} panelRef={panelRef} className={cn("p-1.5", className)}>
        {children(close)}
      </AnchoredPanel>
    </>
  );
}

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  hint?: string;
}

export function Menu({
  trigger,
  items,
  align = "end",
  width = 210,
  header,
}: {
  trigger: (props: TriggerProps) => React.ReactNode;
  items: (MenuItem | "divider")[];
  align?: "start" | "end";
  width?: number;
  header?: string;
}) {
  return (
    <Popover trigger={trigger} align={align} width={width}>
      {(close) => (
        <motion.div className="flex flex-col" initial="hidden" animate="show" variants={listVariants}>
          {header && <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{header}</div>}
          {items.map((item, i) =>
            item === "divider" ? (
              <div key={`d${i}`} className="my-1 border-t border-slate-100 dark:border-white/5" />
            ) : (
              <motion.button
                variants={itemVariants}
                key={item.label}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onClick();
                }}
                className={cn(
                  "group flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40",
                  item.danger
                    ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                    : item.active
                    ? "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                )}
              >
                {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110" />}
                <span className="flex-1 truncate">{item.label}</span>
                {item.active && <Check className="w-3.5 h-3.5" />}
                {item.hint && <span className="text-[10px] text-slate-400">{item.hint}</span>}
              </motion.button>
            )
          )}
        </motion.div>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Dropdown (custom select)                                           */
/* ------------------------------------------------------------------ */

export interface DropdownOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: LucideIcon;
  dot?: string;
  avatar?: string;
  disabled?: boolean;
}

const TRIGGER_SIZES = {
  md: "h-10 px-3 text-sm rounded-xl",
  sm: "h-8 px-2.5 text-xs rounded-lg",
  cell: "h-9 px-3 text-[13px] rounded-none border-0 bg-transparent dark:bg-transparent shadow-none hover:bg-slate-50 dark:hover:bg-white/[0.03] focus:ring-2 focus:ring-inset focus:ring-blue-500",
} as const;

function OptionLead({ option }: { option: DropdownOption }) {
  if (option.avatar) return <Avatar name={option.avatar} size="xs" />;
  if (option.dot) return <span className={cn("w-2 h-2 rounded-full shrink-0", option.dot)} />;
  if (option.icon) return <option.icon className="w-3.5 h-3.5 shrink-0 text-slate-400" />;
  return null;
}

export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchable,
  size = "md",
  align = "start",
  width,
  icon: Icon,
  disabled,
  className,
  label,
  renderTrigger,
}: {
  value: T;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  searchable?: boolean;
  size?: keyof typeof TRIGGER_SIZES;
  align?: "start" | "end";
  width?: number;
  icon?: LucideIcon;
  disabled?: boolean;
  className?: string;
  label?: string;
  renderTrigger?: (selected: DropdownOption<T> | undefined, open: boolean) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const close = React.useCallback(() => setOpen(false), []);
  const { triggerRef, panelRef, placement } = useAnchor(open, close, { align, width: width || 200, matchWidth: !width });
  const listRef = React.useRef<HTMLDivElement>(null);
  const showSearch = searchable ?? options.length > 8;
  const selected = options.find((o) => o.value === value);
  const needle = query.trim().toLowerCase();
  const filtered = needle ? options.filter((o) => o.label.toLowerCase().includes(needle) || o.description?.toLowerCase().includes(needle)) : options;

  const openMenu = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };

  // Keep the highlighted option in view (also brings the selected one into view on open).
  React.useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (opt: DropdownOption<T> | undefined) => {
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(filtered[active]);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        className={cn(
          renderTrigger
            ? "cursor-pointer disabled:cursor-default"
            : cn(
                controlClass,
                "inline-flex items-center gap-2 text-left cursor-pointer shadow-sm",
                open && "border-blue-500 ring-4 ring-blue-500/15",
                TRIGGER_SIZES[size]
              ),
          className
        )}
      >
        {renderTrigger ? (
          renderTrigger(selected, open)
        ) : (
          <>
            {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" />}
            {selected && <OptionLead option={selected} />}
            <span className={cn("flex-1 truncate font-medium", !selected && "text-slate-400")}>{selected?.label || placeholder}</span>
            <ChevronDown className={cn("w-4 h-4 shrink-0 text-slate-400 transition-transform duration-300", open && "rotate-180 text-blue-500")} />
          </>
        )}
      </button>
      <AnchoredPanel open={open} placement={placement} panelRef={panelRef} className="flex flex-col">
        <div onKeyDown={onKeyDown}>
          {showSearch && (
            <div className="p-2 border-b border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02] sticky top-0 z-10">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                  placeholder="Search…"
                  className="w-full h-8 pl-8 pr-2 text-xs rounded-lg bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500"
                />
              </div>
            </div>
          )}
          <div ref={listRef} role="listbox" className="p-1.5 flex flex-col gap-0.5">
            {filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              return (
                <motion.button
                  key={opt.value || `__empty-${i}`}
                  data-idx={i}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i, 10) * 0.018, duration: 0.2 }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(opt)}
                  className={cn(
                    "relative w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2.5 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-40",
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      : i === active
                      ? "bg-slate-100 dark:bg-white/[0.06] text-slate-800 dark:text-white"
                      : "text-slate-600 dark:text-slate-300"
                  )}
                >
                  <OptionLead option={opt} />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{opt.label}</span>
                    {opt.description && <span className="block truncate text-[10px] font-medium text-slate-400 mt-0.5">{opt.description}</span>}
                  </span>
                  {isSelected && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING}>
                      <Check className="w-3.5 h-3.5" />
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
            {filtered.length === 0 && <div className="px-3 py-5 text-center text-xs text-slate-400">No matches</div>}
          </div>
        </div>
      </AnchoredPanel>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

const MODAL_SIZES = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
  full: "sm:max-w-6xl",
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = "md",
  footer,
  children,
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  size?: keyof typeof MODAL_SIZES;
  footer?: React.ReactNode;
  children: React.ReactNode;
  bodyClassName?: string;
}) {
  const mounted = useMounted();
  useEscape(open, onClose);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4 font-sans">
          <motion.div
            className="absolute inset-0 bg-slate-900/45 dark:bg-black/65 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98, transition: { duration: 0.16 } }}
            transition={SPRING}
            className={cn(
              "relative w-full flex flex-col max-h-[92dvh] overflow-hidden bg-white dark:bg-[#0F172A] border border-slate-200/70 dark:border-white/10 shadow-[0_40px_80px_-24px_rgba(15,23,42,0.45)] rounded-t-3xl sm:rounded-3xl",
              MODAL_SIZES[size]
            )}
          >
            <div className="pointer-events-none absolute -top-24 -right-16 w-64 h-64 rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/10 blur-3xl" />
            <div className="relative flex items-start gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100 dark:border-white/5">
              {Icon && (
                <motion.div
                  initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  transition={{ ...SPRING, delay: 0.05 }}
                  className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-[0_10px_24px_-10px_rgba(37,99,235,0.9)]"
                >
                  <Icon className="w-5 h-5 text-white" />
                </motion.div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">{title}</h2>
                {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>}
              </div>
              <IconButton icon={X} label="Close" onClick={onClose} className="-mr-1 -mt-1" />
            </div>
            <div className={cn("relative flex-1 overflow-y-auto px-5 sm:px-6 py-5", bodyClassName)}>{children}</div>
            {footer && (
              <div className="relative flex items-center justify-end gap-2 px-5 sm:px-6 py-3.5 border-t border-slate-100 dark:border-white/5 bg-slate-50/80 dark:bg-white/[0.02]">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Toasts & confirm dialog                                            */
/* ------------------------------------------------------------------ */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface FeedbackApi {
  toast: (message: string, kind?: ToastKind) => void;
  confirm: (opts: { title: string; message?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const FeedbackContext = React.createContext<FeedbackApi | null>(null);

export function useFeedback() {
  const ctx = React.useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside FeedbackProvider");
  return ctx;
}

const TOAST_STYLE: Record<ToastKind, { icon: LucideIcon; tone: string; bar: string }> = {
  success: { icon: CircleCheck, tone: "text-emerald-500", bar: "bg-emerald-500" },
  error: { icon: CircleX, tone: "text-rose-500", bar: "bg-rose-500" },
  info: { icon: Info, tone: "text-blue-500", bar: "bg-blue-500" },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [dialog, setDialog] = React.useState<{
    title: string;
    message?: string;
    confirmLabel?: string;
    danger?: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);
  const mounted = useMounted();

  const toast = React.useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), kind === "error" ? 5000 : 3200);
  }, []);

  const confirm = React.useCallback<FeedbackApi["confirm"]>((opts) => new Promise<boolean>((resolve) => setDialog({ ...opts, resolve })), []);

  const closeDialog = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const api = React.useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      <Modal
        open={!!dialog}
        onClose={() => closeDialog(false)}
        title={dialog?.title || ""}
        size="sm"
        footer={
          <>
            <Button size="sm" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" variant={dialog?.danger ? "danger" : "primary"} onClick={() => closeDialog(true)}>
              {dialog?.confirmLabel || "Confirm"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{dialog?.message}</p>
      </Modal>
      {mounted &&
        createPortal(
          <div className="fixed z-[160] bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 flex flex-col gap-2 items-center md:items-end pointer-events-none font-sans">
            <AnimatePresence>
              {toasts.map((t) => {
                const s = TOAST_STYLE[t.kind];
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 40, scale: 0.95 }}
                    transition={SPRING}
                    className="pointer-events-auto relative overflow-hidden flex items-center gap-2.5 rounded-2xl pl-3.5 pr-4 py-3 text-xs font-semibold shadow-[0_20px_40px_-16px_rgba(15,23,42,0.5)] max-w-sm bg-slate-900/95 text-white dark:bg-white/95 dark:text-slate-900 backdrop-blur"
                  >
                    <s.icon className={cn("w-4 h-4 shrink-0", s.tone)} />
                    {t.message}
                    <motion.span
                      className={cn("absolute left-0 bottom-0 h-0.5", s.bar)}
                      initial={{ width: "100%" }}
                      animate={{ width: "0%" }}
                      transition={{ duration: t.kind === "error" ? 5 : 3.2, ease: "linear" }}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </FeedbackContext.Provider>
  );
}
