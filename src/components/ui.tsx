"use client";

import { cn, initials } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { forwardRef, type ReactNode } from "react";
import type { Profile } from "@/lib/types";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        size === "sm" ? "text-[13px] px-2.5 py-1.5" : "text-sm px-4 py-2",
        variant === "primary" && "bg-pine-600 text-white hover:bg-pine-700",
        variant === "secondary" &&
          "bg-paper-raised border border-paper-line text-ink hover:border-pine-300 hover:text-pine-700",
        variant === "ghost" && "text-ink-soft hover:bg-paper-sunken hover:text-ink",
        variant === "danger" && "bg-clay-600 text-white hover:bg-clay-400",
        className
      )}
      {...props}
    />
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm placeholder:text-ink-faint focus:border-pine-400",
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm placeholder:text-ink-faint focus:border-pine-400",
        className
      )}
      {...props}
    />
  );
});

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "w-full rounded-lg border border-paper-line bg-paper-raised px-3 py-2 text-sm focus:border-pine-400",
        className
      )}
      {...props}
    />
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label className={cn("block text-xs font-medium text-ink-soft mb-1.5 uppercase tracking-wide", className)}>
      {children}
    </label>
  );
}

export function Avatar({
  profile,
  size = 28,
  className,
}: {
  profile?: Pick<Profile, "display_name" | "color" | "avatar_url"> | null;
  size?: number;
  className?: string;
}) {
  const name = profile?.display_name ?? "?";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 select-none",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: profile?.color ?? "#7C837B",
        fontSize: size * 0.4,
      }}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function Chip({
  children,
  color,
  className,
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        !color && "bg-paper-sunken text-ink-soft",
        className
      )}
      style={color ? { backgroundColor: color + "1f", color } : undefined}
    >
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-paper-sunken text-ink-soft",
  in_review: "bg-marigold-100 text-marigold-600",
  final: "bg-pine-100 text-pine-700",
  todo: "bg-paper-sunken text-ink-soft",
  in_progress: "bg-marigold-100 text-marigold-600",
  done: "bg-pine-100 text-pine-700",
  missed: "bg-clay-100 text-clay-600",
  not_started: "bg-paper-sunken text-ink-soft",
  complete: "bg-pine-100 text-pine-700",
  pending: "bg-marigold-100 text-marigold-600",
  not_asked: "bg-paper-sunken text-ink-soft",
  asked: "bg-marigold-100 text-marigold-600",
  confirmed: "bg-pine-100 text-pine-700",
  submitted: "bg-pine-600 text-white",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        STATUS_STYLES[status] ?? "bg-paper-sunken text-ink-soft",
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[8vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={cn(
              "w-full rounded-card bg-paper-raised shadow-lift border border-paper-line",
              wide ? "max-w-3xl" : "max-w-md"
            )}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center justify-between border-b border-paper-line px-5 py-3.5">
              <h2 className="font-display text-lg font-semibold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-md p-1 text-ink-faint hover:bg-paper-sunken hover:text-ink"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-paper-line bg-paper-raised/50 px-6 py-14 text-center">
      <p className="font-display text-lg text-ink-soft">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-sm text-ink-faint">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-pine-200 border-t-pine-600",
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Non-blocking word/char counter: green under the reference limit, amber near it, red past it. */
export function LimitMeter({
  count,
  limit,
  unit,
}: {
  count: number;
  limit: number;
  unit: string;
}) {
  const pct = Math.min(100, (count / limit) * 100);
  const over = count > limit;
  const near = !over && count > limit * 0.9;
  const color = over ? "#A33B34" : near ? "#B8890D" : "#175E54";
  return (
    <div className="flex items-center gap-2.5" aria-live="polite">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-paper-sunken">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs tabular-nums font-medium" style={{ color }}>
        {count.toLocaleString()} / {limit.toLocaleString()} {unit}
        {over && " · over reference limit"}
      </span>
    </div>
  );
}
