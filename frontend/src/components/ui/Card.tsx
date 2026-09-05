import type { ReactNode } from "react";

/**
 * Картка — базова поверхня застосунку. Один компонент замість того, щоб
 * повторювати межу, заокруглення й тінь у кожному місці: так світла й
 * темна теми не розповзаються.
 */
export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag
      className={`overflow-hidden rounded-card border border-border bg-panel shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

/** Шапка картки: заголовок ліворуч, дії праворуч. */
export function CardHeader({
  title,
  action,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 border-b border-border px-4 py-3 ${className}`}
    >
      <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}
