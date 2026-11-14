import { useLayoutEffect, useRef, useState } from "react";
import { Shuffle } from "lucide-react";
import { QUOTES, quoteIndexFor } from "../lib/quotes";
import type { DateKey } from "../lib/dates";

const keyFor = (day: DateKey) => `dayflow.quote.${day}`;

function savedIndex(day: DateKey) {
  try {
    const v = localStorage.getItem(keyFor(day));
    const n = v === null ? NaN : Number(v);
    if (Number.isInteger(n) && n >= 0 && n < QUOTES.length) return n;
  } catch { /* storage unavailable */ }
  return quoteIndexFor(day);
}

/**
 * Shows a quote on a single line. Starts at the CSS font size and shrinks
 * the text just enough to fit the available width — it never wraps.
 */
export function OneLineQuote({ day }: { day: DateKey }) {
  const [picked, setPicked] = useState<{ day: DateKey; index: number }>(() => ({ day, index: savedIndex(day) }));
  const index = picked.day === day ? picked.index : savedIndex(day);
  const quote = QUOTES[index];

  const shuffle = () => {
    let next = index;
    while (QUOTES.length > 1 && next === index) next = Math.floor(Math.random() * QUOTES.length);
    setPicked({ day, index: next });
    try { localStorage.setItem(keyFor(day), String(next)); } catch { /* storage unavailable */ }
  };

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
    <div className="motto-row">
      <div className="motto" ref={box} title={quote.author ? `${quote.text} — ${quote.author}` : quote.text}>
        <span className="motto-line" ref={line}>
          <q>{quote.text}</q>
          {quote.author && <span className="motto-author">— {quote.author}</span>}
        </span>
      </div>
      <button type="button" className="icon-btn" title="Show another quote" aria-label="Show another quote" onClick={shuffle}>
        <Shuffle size={15} />
      </button>
    </div>
  );
}
