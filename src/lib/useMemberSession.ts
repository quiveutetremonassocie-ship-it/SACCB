// Gestion de la session membre dans localStorage (1 an)

const STORAGE_KEY = "saccb_member_session";
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;

export type MemberSession = {
  membreId: string;
  nom: string;
  type: string;
  email: string;
  expiry: number;
  paid?: boolean; // false = adhésion non renouvelée pour la saison en cours
  isAdmin?: boolean; // true = accès au panneau admin
  adminCode?: string; // code admin stocké dans la session (évite une clé localStorage séparée)
  newsOptIn?: boolean; // préférence news du club
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
    expiry: Date.now() + ONE_YEAR,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearMemberSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
