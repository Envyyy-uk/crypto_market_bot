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
        accent: "rgb(var(--c-accent) / <alpha-value>)", // акцент бренду (індиго)
        bull: "rgb(var(--c-bull) / <alpha-value>)",     // зростання
        bear: "rgb(var(--c-bear) / <alpha-value>)",     // падіння
        deep: "rgb(var(--c-deep) / <alpha-value>)",     // текст на заливці акцентом
      },
      // Тіні теж із змінних: на світлому це м'яке підняття картки,
      // на темному — внутрішня підсвітка згори, бо тінь там не видно.
      boxShadow: {
        card: "var(--shadow-card)",
        pop: "var(--shadow-pop)",
      },
      fontFamily: {
        display: ["Poppins", "Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      // Одна шкала заокруглень на весь застосунок: control -> card -> pill
      borderRadius: {
        control: "0.625rem", // 10px — кнопки, поля, чипи
        card: "1rem",        // 16px — картки й панелі
      },
      keyframes: {
        "row-flash-up": {
          "0%": { backgroundColor: "rgb(var(--c-bull) / 0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
        "row-flash-down": {
          "0%": { backgroundColor: "rgb(var(--c-bear) / 0.16)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "row-flash-up": "row-flash-up 0.7s ease-out",
        "row-flash-down": "row-flash-down 0.7s ease-out",
      },
    },
  },
  plugins: [],
};
