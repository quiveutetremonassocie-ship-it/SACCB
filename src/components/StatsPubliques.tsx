"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Users, Trophy, Calendar, Target } from "lucide-react";

function useCountUp(target: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStarted(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [startOnView]);

  useEffect(() => {
    if (!started || target === 0) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return { count, ref };
}

export default function StatsPubliques({
  membresCount,
  tournoiCount,
  anneesExistence,
  podiumsCount,
}: {
  membresCount: number;
  tournoiCount: number;
  anneesExistence: number;
  podiumsCount: number;
}) {
  const stat1 = useCountUp(membresCount);
  const stat2 = useCountUp(tournoiCount);
  const stat3 = useCountUp(anneesExistence);
  const stat4 = useCountUp(podiumsCount);

  const stats = [
    {
      ref: stat1.ref,
      value: stat1.count,
      suffix: "+",
      label: "Adherents",
      icon: <Users className="w-6 h-6" />,
      color: "from-blue-500 to-cyan-500",
      bgLight: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      ref: stat2.ref,
      value: stat2.count,
      suffix: "",
      label: "Tournois joues",
      icon: <Trophy className="w-6 h-6" />,
      color: "from-amber-500 to-orange-500",
      bgLight: "bg-amber-50",
      textColor: "text-amber-600",
    },
    {
      ref: stat3.ref,
      value: stat3.count,
      suffix: " ans",
      label: "D'existence",
      icon: <Calendar className="w-6 h-6" />,
      color: "from-emerald-500 to-teal-500",
      bgLight: "bg-emerald-50",
      textColor: "text-emerald-600",
    },
    {
      ref: stat4.ref,
      value: stat4.count,
      suffix: "",
      label: "Podiums",
      icon: <Target className="w-6 h-6" />,
      color: "from-purple-500 to-pink-500",
      bgLight: "bg-purple-50",
      textColor: "text-purple-600",
    },
  ];

  return (
    <section id="stats" className="py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-blue-600">En chiffres</span>
          </div>
          <h2 className="font-display text-4xl md:text-5xl h-display mb-4">
            Le SACCB en quelques chiffres
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Une association qui grandit chaque annee grace a ses membres passionnes.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              ref={s.ref}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition group"
            >
              <div className={`w-12 h-12 mx-auto rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition`}>
                {s.icon}
              </div>
              <p className={`text-3xl md:text-4xl font-bold ${s.textColor} font-display tracking-wider`}>
                {s.value > 0 ? s.value : "-"}{s.value > 0 ? s.suffix : ""}
              </p>
              <p className="text-xs uppercase tracking-widest text-slate-500 mt-2 font-semibold">
                {s.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
