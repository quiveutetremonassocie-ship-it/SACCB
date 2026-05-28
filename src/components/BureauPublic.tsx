"use client";

import { Users } from "lucide-react";
import { BureauMember } from "@/lib/types";
import { motion } from "framer-motion";

export default function BureauPublic({ members }: { members: BureauMember[] }) {
  if (members.length === 0) return null;

  return (
    <section id="bureau" className="relative py-20 md:py-28 overflow-hidden">
      {/* Fond subtil */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/60 via-white to-white pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest mb-4">
            <Users className="w-3.5 h-3.5" />
            Bureau de l&apos;association
          </div>
          <h2 className="font-display text-3xl md:text-4xl text-slate-800 tracking-wider">
            Votre bureau
          </h2>
          <p className="text-slate-500 mt-3 max-w-lg mx-auto text-sm">
            Les membres du bureau qui font vivre le club au quotidien.
          </p>
        </motion.div>

        {/* Grille des membres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {members.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="group bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-indigo-200 transition-all duration-300"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-md group-hover:scale-105 transition-transform">
                  {m.prenom.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-800">
                    {m.prenom} {m.nom}
                  </p>
                  <p className="text-sm text-indigo-600 font-medium mt-0.5">
                    {m.role}
                  </p>
                  {m.description && (
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      {m.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
