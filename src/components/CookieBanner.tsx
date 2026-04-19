"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem("saccb_cookies_ok")) setShow(true);
    } catch {}
  }, []);

  function dismiss() {
    try { localStorage.setItem("saccb_cookies_ok", "1"); } catch {}
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9000] bg-[#0f2440] border-t border-white/10 shadow-2xl">
      <div className="max-w-5xl mx-auto px-5 py-4 flex items-center gap-4 flex-wrap justify-between">
        <p className="text-sm text-white/75 flex-1 min-w-[260px]">
          🍪 Ce site utilise le <strong className="text-white/90">stockage local</strong> (localStorage)
          uniquement pour gérer votre session membre. Aucun cookie publicitaire ni tracker tiers.{" "}
          <Link href="/politique-confidentialite" className="underline text-blue-300 hover:text-blue-200 transition">
            Politique de confidentialité →
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl transition shrink-0"
        >
          <X className="w-4 h-4" /> J&apos;ai compris
        </button>
      </div>
    </div>
  );
}
