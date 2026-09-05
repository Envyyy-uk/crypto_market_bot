import { useEffect, useRef, useState } from "react";

/**
 * Напрямок останньої зміни числа — для короткого спалаху кольором.
 * Повертає "up" / "down" на ~0.7с, потім null.
 *
 * Живе окремо від компонентів, бо потрібне і hero-картці, і кожному
 * рядку списку ринків.
 */
export function usePriceFlash(value: number, ms = 700): "up" | "down" | null {
  const prev = useRef(value);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (value === prev.current) return;
    setFlash(value > prev.current ? "up" : "down");
    prev.current = value;
    const t = setTimeout(() => setFlash(null), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return flash;
}
