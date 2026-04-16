"use client";

import { LogOut, MessageCircle, UserCircle2, Trophy } from "lucide-react";
import { MemberSession, clearMemberSession } from "@/lib/useMemberSession";

export default function MemberPanel({
  session,
  y1,
  y2,
  whatsappLink,
  onClose,
}: {
  session: MemberSession;
  y1: number;
  y2: number;
  whatsappLink?: string | null;
  onClose: () => void;
}) {
  function logout() {
    clearMemberSession();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[4500] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1e3a5f] to-emerald-600 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-xl tracking-wider text-slate-800">Espace membre</h3>
              <p className="text-xs text-slate-400">Saison {y1}–{y2}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>

        {/* Badge membre */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" /> Votre carte membre
          </p>
          <Badge nom={session.nom} type={session.type} y1={y1} y2={y2} />
          <p className="text-xs text-slate-400 text-center mt-2">
            Faites une capture d&apos;écran pour la conserver.
          </p>
        </div>

        {/* WhatsApp */}
        {whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold px-5 py-3 rounded-xl transition w-full"
          >
            <MessageCircle className="w-5 h-5" />
            Rejoindre le groupe WhatsApp
          </a>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
            <MessageCircle className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-xs text-slate-400">
              Le lien WhatsApp sera disponible prochainement.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ nom, type, y1, y2 }: { nom: string; type: string; y1: number; y2: number }) {
  return (
    <div className="relative max-w-sm mx-auto bg-gradient-to-br from-[#1e3a5f] to-[#0f2440] border-2 border-blue-400/60 rounded-2xl p-6 shadow-2xl shadow-blue-500/20 overflow-hidden">
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
      <div className="font-display text-xl text-blue-400 tracking-widest border-b border-white/10 pb-2 mb-4">
        MEMBRE OFFICIEL SACCB
      </div>
      <div className="text-2xl font-bold uppercase text-white">{nom}</div>
      <div className="text-xs uppercase tracking-widest text-white/50 mt-1">
        Saison {y1}–{y2}
      </div>
      <div className="flex items-end justify-between mt-6">
        <span className="text-xs uppercase tracking-widest text-white/60">{type}</span>
        <span className="font-display text-lg text-white/40">ST-ADRESSE</span>
      </div>
    </div>
  );
}
