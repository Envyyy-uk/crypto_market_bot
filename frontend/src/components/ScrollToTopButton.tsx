import { useEffect, useState } from "react";

const SHOW_AFTER_PX = 400;

/** Плаваюча кнопка ↑: з'являється після прокрутки вниз, плавно веде нагору. */
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Scroll to top"
      className={`scroll-top-btn fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-panel text-ink shadow-lg shadow-black/30 transition-colors hover:bg-panel2 sm:bottom-6 sm:right-6 ${
        visible ? "visible" : ""
      }`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
