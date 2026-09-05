/** Заглушка на час завантаження — замість порожнього місця. */
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}
