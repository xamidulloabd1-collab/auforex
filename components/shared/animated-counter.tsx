"use client";

import * as React from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

/** Counts up to a real value from the database when scrolled into view. */
export function AnimatedCounter({ value, className }: { value: number; className?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration: Math.min(1.6, 0.6 + value / 60),
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={className}>
      <span className="tabular">{reduce ? value : display}</span>
    </span>
  );
}
