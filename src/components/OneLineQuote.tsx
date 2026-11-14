import { useLayoutEffect, useRef } from "react";
import type { Quote } from "../lib/quotes";

/**
 * Shows a quote on a single line. Starts at the CSS font size and shrinks
 * the text just enough to fit the available width — it never wraps.
 */
export function OneLineQuote({ quote }: { quote: Quote }) {
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = box.current;
    const inner = line.current;
    if (!el || !inner) return;
    let lastWidth = -1;

    const fit = () => {
      el.style.fontSize = ""; // back to the CSS size (the maximum)
      const max = parseFloat(getComputedStyle(el).fontSize);
      const avail = el.clientWidth;
      const need = inner.scrollWidth;
      if (avail > 0 && need > avail) {
        el.style.fontSize = `${Math.max(9, Math.floor(max * (avail / need) * 0.98))}px`;
      }
    };

    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [quote.text, quote.author]);

  return (
    <div className="motto" ref={box} title={quote.author ? `${quote.text} — ${quote.author}` : quote.text}>
      <span className="motto-line" ref={line}>
        <q>{quote.text}</q>
        {quote.author && <span className="motto-author">— {quote.author}</span>}
      </span>
    </div>
  );
}
