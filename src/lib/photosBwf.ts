// 📸 Photo d'un joueur du classement : copie gardée dans notre stockage (le site n'affiche jamais d'image hébergée
// ailleurs), avec l'auteur et la licence pour pouvoir la créditer (CC BY / CC BY-SA : l'auteur doit être cité).
// Le serveur choisit et copie ces photos (tâche cron_classement_bwf) ; un joueur sans photo libre a ses initiales.

export type PhotoJoueur = {
  url: string;          // image dans notre stockage (≈ 480 px de large)
  auteur: string;       // texte seul
  licence: string;      // ex. « CC BY-SA 4.0 »
  licenceUrl?: string;
  fichierUrl: string;   // page Wikimedia Commons de la photo
};
