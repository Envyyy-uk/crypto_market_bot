/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Значення живуть у CSS-змінних (index.css) — темна/світла тема (Завдання 18).
        // RGB-трійки, щоб працювали модифікатори прозорості (bg-bull/15).
        base: "rgb(var(--c-base) / <alpha-value>)",     // тло застосунку
        panel: "rgb(var(--c-panel) / <alpha-value>)",   // картки, панелі
        panel2: "rgb(var(--c-panel2) / <alpha-value>)", // вкладені елементи / hover
        border: "rgb(var(--c-border) / <alpha-value>)",
        ink: "rgb(var(--c-ink) / <alpha-value>)",       // основний текст
        muted: "rgb(var(--c-muted) / <alpha-value>)",   // другорядний текст
        amber: "rgb(var(--c-amber) / <alpha-value>)",   // акцент бренду
        bull: "rgb(var(--c-bull) / <alpha-value>)",     // зростання
        bear: "rgb(var(--c-bear) / <alpha-value>)",     // падіння
        deep: "rgb(var(--c-deep) / <alpha-value>)",     // текст на янтарних кнопках (завжди темний)
      },
      fontFamily: {
        display: ["Poppins", "Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
