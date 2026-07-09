/* VETA · cinta horizontal en bucle (categorías / claims). Decorativa. */

import React from "react";

export function Marquee({ items, compact = false }) {
  const content = (
    <span>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <span>{it}</span>
          <span className="marquee-dot" />
        </React.Fragment>
      ))}
    </span>
  );
  return (
    <div className={compact ? "marquee marquee--compact" : "marquee"} aria-hidden="true">
      <div className="marquee-track">
        {content}
        {content}
      </div>
    </div>
  );
}
