"use client";

import { useEffect, useRef, useCallback } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export default function ScrollButton() {
  const btnRef = useRef<HTMLButtonElement>(null);
  const iconUpRef = useRef<SVGSVGElement>(null);
  const iconDownRef = useRef<SVGSVGElement>(null);
  const atBottomRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const btn = btnRef.current;
        if (!btn) return;

        const scrollY = window.scrollY;
        const windowH = window.innerHeight;
        const docH = document.documentElement.scrollHeight;
        const isVisible = scrollY > 200;
        const isBottom = scrollY + windowH >= docH - 150;

        btn.style.display = isVisible ? "flex" : "none";
        atBottomRef.current = isBottom;

        if (iconUpRef.current && iconDownRef.current) {
          iconUpRef.current.style.display = isBottom ? "block" : "none";
          iconDownRef.current.style.display = isBottom ? "none" : "block";
        }
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const handleClick = useCallback(() => {
    if (atBottomRef.current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }, []);

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      style={{ display: "none" }}
      className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[#1e3a5f]/90 hover:bg-[#1e3a5f] text-white shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 items-center justify-center group"
      aria-label="Scroll"
    >
      <ChevronUp ref={iconUpRef} className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" style={{ display: "none" }} />
      <ChevronDown ref={iconDownRef} className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" style={{ display: "block" }} />
    </button>
  );
}
