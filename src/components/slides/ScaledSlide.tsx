import { useEffect, useRef, useState, ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/** Renders a 1920x1080 slide scaled to fit its container. */
export default function ScaledSlide({ children, className = "" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      setScale(Math.min(width / 1920, height / 1080));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
    >
      <div
        className="slide-wrapper"
        style={{ ["--slide-scale" as string]: String(scale) }}
      >
        {children}
      </div>
    </div>
  );
}
