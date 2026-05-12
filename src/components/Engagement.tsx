"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, MessageSquare, Lock, Send, Lightbulb, ChevronDown, ChevronUp, FileText, CheckCircle2, EyeOff, Calendar, FileDown } from "lucide-react";
import { Poll, AGItem, ReunionReport } from "@/lib/types";
import { MemberSession } from "@/lib/useMemberSession";
import { memberVotePoll, memberSubmitAGItem, fetchMyVotes } from "@/lib/db";

type PollPublic = Poll & {
  voteCounts?: Record<number, number>;
  totalVotes?: number;
};

export default function Engagement({
  polls = [],
  agItems = [],
  reunionReports = [],
  memberSession,
  onLoginRequest,
  onRefresh,
}: {
  polls?: PollPublic[];
  agItems?: AGItem[];
  reunionReports?: ReunionReport[];
  memberSession: MemberSession | null;
  onLoginRequest: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [myVotes, setMyVotes] = useState<Record<string, number[]>>({});
  const [voting, setVoting] = useState<string | null>(null);
  const [agOpen, setAgOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState<string | null>(null);

  // Form question/idée AG
  const [agText, setAgText] = useState("");
  const [agType, setAgType] = useState<"question" | "amelioration">("question");
  const [agAnonymous, setAgAnonymous] = useState(false);
  const [agSending, setAgSending] = useState(false);
  const [agMsg, setAgMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Charger les votes du membre
  useEffect(() => {
    if (!memberSession || memberSession.paid !== true) {
      setMyVotes({});
      return;
    }
    const code = memberSession.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    if (!code) return;
    fetchMyVotes(memberSession.email, code, memberSession.membreId).then(setMyVotes);
  }, [memberSession, polls]);

  const openPolls = useMemo(() => polls.filter((p) => !p.closed), [polls]);
  const closedPolls = useMemo(() => polls.filter((p) => p.closed), [polls]);

  async function vote(pollId: string, optionIdx: number) {
    if (!memberSession || memberSession.paid !== true) {
      onLoginRequest();
      return;
    }
    const code = memberSession.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    if (!code) { onLoginRequest(); return; }
    setVoting(pollId + ":" + optionIdx);
    const r = await memberVotePoll(memberSession.email, code, memberSession.membreId, pollId, optionIdx);
    setVoting(null);
    if (r.ok) {
      await onRefresh();
      const fresh = await fetchMyVotes(memberSession.email, code, memberSession.membreId);
      setMyVotes(fresh);
    } else {
      alert(r.reason || "Erreur lors du vote.");
    }
  }

  async function submitAGItem(e: React.FormEvent) {
    e.preventDefault();
    if (!memberSession || memberSession.paid !== true) {
      onLoginRequest();
      return;
    }
    if (agText.trim().length < 5) {
      setAgMsg({ ok: false, text: "Votre message doit faire au moins 5 caractères." });
      return;
    }
    const code = memberSession.adminCode || sessionStorage.getItem("saccb_member_code") || "";
    if (!code) { onLoginRequest(); return; }
    setAgSending(true);
    setAgMsg(null);
    const r = await memberSubmitAGItem(
      memberSession.email,
      code,
      memberSession.membreId,
      agText.trim(),
      agType,
      agAnonymous
    );
    setAgSending(false);
    if (r.ok) {
      setAgMsg({ ok: true, text: "✅ Votre message a bien été transmis au bureau !" });
      setAgText("");
      setAgAnonymous(false);
      await onRefresh();
      setTimeout(() => setAgMsg(null), 4000);
    } else {
      setAgMsg({ ok: false, text: r.reason || "Erreur lors de l'envoi." });
    }
  }

  // Sépare questions et améliorations
  const questions = useMemo(() => agItems.filter((i) => i.type === "question"), [agItems]);
  const ameliorations = useMemo(() => agItems.filter((i) => i.type === "amelioration"), [agItems]);

  const hasContent = polls.length > 0 || reunionReports.length > 0 || agItems.length > 0 || memberSession;

  if (!hasContent) return null;

  return (
    <section id="engagement" className="bg-section-wrap">
      <div className="section-pad">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <div className="sport-label mb-5">
            <span className="sport-label-dot" />
            <span className="sport-label-text text-purple-600">La parole aux adhérents</span>
          </div>
          <h2 className="font-display text-5xl md:text-6xl h-display mb-4">Sondages & AG</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Donnez votre avis, posez vos questions, proposez vos idées pour faire vivre le club.
          </p>
        </motion.div>

        {/* Si non-membre/non-payé : message */}
        {(!memberSession || memberSession.paid !== true) && (
          <div className="max-w-2xl mx-auto mb-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center">
            <Lock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-1">Réservé aux adhérents</p>
            <p className="text-slate-500 text-sm mb-4">
              Connectez-vous à votre espace membre pour voter aux sondages et soumettre vos questions.
            </p>
            <button
              onClick={onLoginRequest}
              className="btn-primary !text-sm"
            >
              <Lock className="w-4 h-4" /> Se connecter à l'espace membre
            </button>
          </div>
        )}

        {/* SONDAGES */}
        {openPolls.length > 0 && (
          <div className="max-w-3xl mx-auto mb-10">
            <h3 className="flex items-center gap-2 font-display text-2xl tracking-wider text-slate-800 mb-4">
              <BarChart3 className="w-6 h-6 text-purple-500" /> Sondages en cours
            </h3>
            <div className="space-y-4">
              {openPolls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  myVotes={myVotes[poll.id] || []}
                  canVote={memberSession?.paid === true}
                  votingKey={voting}
                  onVote={(idx) => vote(poll.id, idx)}
                />
              ))}
            </div>
          </div>
        )}

        {closedPolls.length > 0 && (
          <details className="max-w-3xl mx-auto mb-10">
            <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700 mb-3">
              Voir les sondages fermés ({closedPolls.length})
            </summary>
            <div className="space-y-4 mt-3">
              {closedPolls.map((poll) => (
                <PollCard
                  key={poll.id}
                  poll={poll}
                  myVotes={myVotes[poll.id] || []}
                  canVote={false}
                  votingKey={null}
                  onVote={() => {}}
                />
              ))}
            </div>
          </details>
        )}

        {/* QUESTIONS / IDÉES À L'AG */}
        {memberSession?.paid === true && (
          <div className="max-w-3xl mx-auto mb-10">
            <h3 className="flex items-center gap-2 font-display text-2xl tracking-wider text-slate-800 mb-2">
              <MessageSquare className="w-6 h-6 text-amber-500" /> Réunion / AG
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Posez vos questions au bureau ou proposez des améliorations pour le club.
              Vos messages seront traités lors de la prochaine assemblée.
            </p>

            <form onSubmit={submitAGItem} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setAgType("question")}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition border ${agType === "question" ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                >
                  <MessageSquare className="w-4 h-4 inline mr-1.5" /> Question
                </button>
                <button
                  type="button"
                  onClick={() => setAgType("amelioration")}
                  className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition border ${agType === "amelioration" ? "bg-emerald-100 border-emerald-300 text-emerald-800" : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}
                >
                  <Lightbulb className="w-4 h-4 inline mr-1.5" /> Idée d'amélioration
                </button>
              </div>

              <textarea
                className="input w-full min-h-[100px] resize-y"
                placeholder={agType === "question" ? "Votre question pour le bureau…" : "Votre idée pour améliorer le club…"}
                value={agText}
                onChange={(e) => setAgText(e.target.value)}
                maxLength={2000}
                required
              />

              <label className="flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agAnonymous}
                  onChange={(e) => setAgAnonymous(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300"
                />
                <EyeOff className="w-4 h-4 text-slate-400" />
                Envoyer anonymement (votre nom ne sera pas visible)
              </label>

              {agMsg && (
                <p className={`text-xs mt-2 ${agMsg.ok ? "text-emerald-600" : "text-red-500"} font-medium`}>
                  {agMsg.text}
                </p>
              )}

              <button
                type="submit"
                disabled={agSending || agText.trim().length < 5}
                className="btn-primary w-full mt-3 !text-sm"
              >
                {agSending ? "Envoi..." : (<><Send className="w-4 h-4" /> Envoyer au bureau</>)}
              </button>
            </form>
          </div>
        )}

        {/* AFFICHAGE DES QUESTIONS / IDÉES */}
        {(questions.length > 0 || ameliorations.length > 0) && (
          <div className="max-w-3xl mx-auto mb-10">
            <button
              onClick={() => setAgOpen(!agOpen)}
              className="flex items-center justify-between w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 hover:bg-slate-50 transition shadow-sm"
            >
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <MessageSquare className="w-5 h-5 text-amber-500" />
                Questions & idées de la saison ({agItems.length})
              </span>
              {agOpen ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {agOpen && (
              <div className="mt-3 space-y-2">
                {agItems.slice().reverse().map((item) => (
                  <AGItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* COMPTES-RENDUS DE RÉUNION */}
        {reunionReports.length > 0 && (
          <div className="max-w-3xl mx-auto">
            <h3 className="flex items-center gap-2 font-display text-2xl tracking-wider text-slate-800 mb-4">
              <FileText className="w-6 h-6 text-blue-500" /> Comptes-rendus de réunions
            </h3>
            <div className="space-y-2">
              {reunionReports.slice().reverse().map((r) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <button
                    onClick={() => setReportOpen(reportOpen === r.id ? null : r.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        r.type === "ag" ? "bg-purple-100" :
                        r.type === "debut_saison" ? "bg-emerald-100" :
                        r.type === "fin_saison" ? "bg-amber-100" : "bg-slate-100"
                      }`}>
                        <Calendar className={`w-4 h-4 ${
                          r.type === "ag" ? "text-purple-600" :
                          r.type === "debut_saison" ? "text-emerald-600" :
                          r.type === "fin_saison" ? "text-amber-600" : "text-slate-600"
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{r.title}</p>
                        <p className="text-xs text-slate-400">
                          {labelType(r.type)} · {new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    {reportOpen === r.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>
                  {reportOpen === r.id && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                      {r.pdfUrl && (
                        <a
                          href={r.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-sm font-semibold transition"
                        >
                          <FileDown className="w-4 h-4" />
                          {r.pdfName || "Télécharger le PDF"}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function labelType(t: ReunionReport["type"]): string {
  switch (t) {
    case "ag": return "Assemblée Générale";
    case "debut_saison": return "Début de saison";
    case "fin_saison": return "Fin de saison";
    default: return "Réunion";
  }
}

function PollCard({
  poll,
  myVotes,
  canVote,
  votingKey,
  onVote,
}: {
  poll: PollPublic;
  myVotes: number[];
  canVote: boolean;
  votingKey: string | null;
  onVote: (idx: number) => void;
}) {
  const total = poll.totalVotes ?? 0;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-semibold text-slate-800 text-base">{poll.question}</h4>
        {poll.closed && (
          <span className="text-[10px] uppercase tracking-widest bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-semibold shrink-0">
            Fermé
          </span>
        )}
      </div>
      <div className="space-y-2">
        {poll.options.map((opt, i) => {
          const count = poll.voteCounts?.[i] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const voted = myVotes.includes(i);
          const loading = votingKey === poll.id + ":" + i;
          return (
            <button
              key={i}
              onClick={() => canVote && !poll.closed && onVote(i)}
              disabled={!canVote || poll.closed || loading}
              className={`relative block w-full text-left px-4 py-2.5 rounded-xl border transition overflow-hidden ${
                voted
                  ? "border-purple-400 bg-purple-50"
                  : canVote && !poll.closed
                  ? "border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 cursor-pointer"
                  : "border-slate-200 bg-slate-50 cursor-not-allowed"
              }`}
            >
              {/* Barre de progression en fond */}
              <div
                className={`absolute inset-y-0 left-0 ${voted ? "bg-purple-100" : "bg-slate-100"} transition-all`}
                style={{ width: `${pct}%`, zIndex: 0 }}
              />
              <div className="relative flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  {voted && <CheckCircle2 className="w-4 h-4 text-purple-500" />}
                  {opt}
                </span>
                <span className="text-xs text-slate-500 shrink-0">
                  {count} vote{count > 1 ? "s" : ""} · {pct}%
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-400 mt-3">
        {total} participation{total > 1 ? "s" : ""}
        {poll.multipleChoice && " · choix multiples possibles"}
      </p>
    </div>
  );
}

function AGItemCard({ item }: { item: AGItem }) {
  const isQ = item.type === "question";
  return (
    <div className={`border rounded-xl p-4 ${isQ ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isQ ? <MessageSquare className="w-4 h-4 text-amber-600 shrink-0" /> : <Lightbulb className="w-4 h-4 text-emerald-600 shrink-0" />}
          <span className={`text-[10px] uppercase tracking-widest font-semibold ${isQ ? "text-amber-700" : "text-emerald-700"}`}>
            {isQ ? "Question" : "Idée"}
          </span>
          {item.resolved && (
            <span className="text-[10px] uppercase tracking-widest bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />
              Traitée
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0">
          {new Date(item.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
        </span>
      </div>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.text}</p>
      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
        {item.anonymous ? (
          <>
            <EyeOff className="w-3 h-3" /> Anonyme
          </>
        ) : (
          <>— {item.authorNom || "Anonyme"}</>
        )}
      </p>
      {item.reponse && (
        <div className="mt-3 pt-3 border-t border-white/60">
          <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 mb-1">
            Réponse du bureau {item.reponseDate && `· ${new Date(item.reponseDate).toLocaleDateString("fr-FR")}`}
          </p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{item.reponse}</p>
        </div>
      )}
    </div>
  );
}
