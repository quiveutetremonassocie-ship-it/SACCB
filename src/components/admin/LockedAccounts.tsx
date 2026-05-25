"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Unlock, RefreshCw } from "lucide-react";
import { adminListLockedAccounts, adminUnlockAccount } from "@/lib/db";

export default function LockedAccounts({
  adminEmail,
  adminCode,
  readOnly,
}: {
  adminEmail: string;
  adminCode: string;
  readOnly: boolean;
}) {
  const [locked, setLocked] = useState<{ email: string; minutesLeft: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await adminListLockedAccounts(adminEmail, adminCode);
    setLoading(false);
    if (r.ok && r.locked) setLocked(r.locked);
  }, [adminEmail, adminCode]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleUnlock(email: string) {
    if (!confirm(`Débloquer le compte ${email} ?`)) return;
    const r = await adminUnlockAccount(email, adminEmail, adminCode);
    if (r.ok) {
      setLocked((l) => l.filter((x) => x.email !== email));
    } else {
      alert(r.reason || "Erreur");
    }
  }

  return (
    <div className="glass p-3 md:p-4 border border-rose-200">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shrink-0">
          <Lock className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base md:text-lg tracking-wider text-slate-800">Comptes bloqués</h3>
          <p className="text-[11px] text-slate-500">
            5 tentatives ratées en 15 min = blocage 30 min auto
          </p>
        </div>
        <button onClick={refresh} className="text-slate-400 hover:text-slate-700" title="Actualiser">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {locked.length === 0 ? (
        <p className="text-xs text-emerald-600 italic">✅ Aucun compte bloqué actuellement</p>
      ) : (
        <ul className="space-y-1.5">
          {locked.map((l) => (
            <li key={l.email} className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-mono text-slate-700 truncate">{l.email}</p>
                <p className="text-[10px] text-rose-600">Débloqué dans {l.minutesLeft} min</p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleUnlock(l.email)}
                  className="shrink-0 inline-flex items-center gap-1 text-xs bg-emerald-500 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-md"
                >
                  <Unlock className="w-3 h-3" /> Débloquer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
