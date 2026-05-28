"use client";

import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export default function ScrollButton() {
  const [atBottom, setAtBottom] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrollY = window.scrollY;
      const windowH = window.innerHeight;
      const docH = document.documentElement.scrollHeight;

      // Visible après avoir scrollé un peu (200px)
      setVisible(scrollY > 200);

      // Considéré "en bas" si on est à moins de 150px du fond
      setAtBottom(scrollY + windowH >= docH - 150);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleClick() {
    if (atBottom) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    }
  }

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full bg-[#1e3a5f]/90 hover:bg-[#1e3a5f] text-white shadow-lg hover:shadow-xl backdrop-blur-sm transition-all duration-300 flex items-center justify-center group"
      title={atBottom ? "Remonter en haut" : "Descendre en bas"}
      aria-label={atBottom ? "Remonter en haut" : "Descendre en bas"}
    >
      {atBottom ? (
        <ChevronUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
      ) : (
        <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
      )}
    </button>
  );
}
