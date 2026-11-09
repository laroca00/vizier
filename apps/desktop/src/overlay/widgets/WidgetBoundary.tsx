import { Component, type ReactNode } from "react";

/** A widget that throws takes only its own box down; the rest of the overlay and the game go on. */
export class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("overlay widget failed", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** What an opened panel says when there is nothing to put in it. */
export function EmptyCard({ text }: { text: string }) {
  return (
    <section className="overlay__card overlay__empty">
      <p className="overlay__caption">{text}</p>
    </section>
  );
}
