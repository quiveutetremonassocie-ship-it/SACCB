// Ancienne apparition en fondu au défilement : retirée du nouveau design (le contenu est visible tout de suite,
// plus rapide et plus lisible). Le composant reste pour ne pas toucher aux pages qui l'utilisent.
export default function FadeInSection({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return <div className={className}>{children}</div>;
}
