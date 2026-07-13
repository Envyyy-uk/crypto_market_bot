import { Component, type ReactNode } from "react";

/**
 * Помилка рендера будь-якої сторінки не кладе весь застосунок (Завдання 23):
 * користувач бачить просте повідомлення і кнопку перезавантаження,
 * технічні деталі — лише в консолі.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled UI error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-sm px-4 pt-16 text-center">
          <p className="text-sm text-ink">Something went wrong on this page.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-deep"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
