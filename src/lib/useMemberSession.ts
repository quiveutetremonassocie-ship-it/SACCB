// Gestion de la session membre dans localStorage avec rotation périodique :
// - 👑 Admin : 14 jours (compte sensible, on renouvelle le 2FA souvent)
// - 🏸 Membre normal : 60 jours (pas la peine de les embêter trop souvent)

const STORAGE_KEY = "saccb_member_session";
const ADMIN_SESSION_MS = 14 * 24 * 60 * 60 * 1000;
const MEMBER_SESSION_MS = 60 * 24 * 60 * 60 * 1000;
export function sessionDurationMs(isAdmin: boolean): number {
  return isAdmin ? ADMIN_SESSION_MS : MEMBER_SESSION_MS;
}

export type MemberSession = {
  membreId: string;
  nom: string;
  type: string;
  email: string;
  expiry: number;
  paid?: boolean; // false = adhésion non renouvelée pour la saison en cours
  isAdmin?: boolean; // true = accès au panneau admin
  adminCode?: string; // code admin stocké dans la session (évite une clé localStorage séparée)
  // 🔑 Code personnel du membre, persistant en localStorage. Permet d'accéder aux
  // ressources protégées (actus privées, FAQ, etc.) depuis n'importe quel onglet/page.
  // Note : c'est le même niveau de sensibilité que la session elle-même, qui contient
  // déjà email + membreId. Le code étant déjà nécessaire pour ces actions, le stocker
  // ici avec la session a le même profil de sécurité.
  memberCode?: string;
  newsOptIn?: boolean; // préférence news de l’association
  // 🔕 Ids des tournois pour lesquels le membre a coché "pas intéressé(e)"
  tournoisIgnored?: string[];
  // 🚪 Saison "y1-y2" pour laquelle le membre ne souhaite pas renouveler
  renewalSkippedFor?: string;
};

export function getMemberSession(): MemberSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: MemberSession = JSON.parse(raw);
    if (Date.now() > session.expiry) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setMemberSession(
  membre: Omit<MemberSession, "expiry">
): void {
  const session: MemberSession = {
    ...membre,
    expiry: Date.now() + sessionDurationMs(membre.isAdmin === true),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearMemberSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
