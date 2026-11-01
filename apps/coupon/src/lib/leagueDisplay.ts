// Drapeau par pays et ordre de priorité des grands championnats — source
// unique partagée entre page.tsx (regroupement de la page d'accueil) et
// LeagueSearch.tsx (menu déroulant), pour que les deux restent identiques
// sans les dupliquer (demande explicite du 01/11/2026).

export const COUNTRY_FLAG: Record<string, string> = {
  England: "🏴", Scotland: "🏴", France: "🇫🇷", Spain: "🇪🇸", Italy: "🇮🇹", Germany: "🇩🇪",
  Europe: "🇪🇺", Brazil: "🇧🇷", Argentina: "🇦🇷", USA: "🇺🇸", Mexico: "🇲🇽",
  Japan: "🇯🇵", Turkey: "🇹🇷", Australia: "🇦🇺", Netherlands: "🇳🇱", Portugal: "🇵🇹",
  Africa: "🌍", World: "🌐", Chad: "🇹🇩", "South America": "🌎",
  "South Korea": "🇰🇷", Canada: "🇨🇦", "North America": "🌎",
  Norway: "🇳🇴", "Saudi Arabia": "🇸🇦", Belgium: "🇧🇪", Switzerland: "🇨🇭", Russia: "🇷🇺",
};

// Grands championnats affichés en premier, dans cet ordre — demande
// explicite du 31/10/2026 (étendue au menu déroulant le 01/11/2026). Noms
// exacts tels qu'enregistrés en base (voir SPORTS_CONFIG, odds.service.ts) :
// un nom absent de cette liste n'est pas une erreur, il retombe simplement
// en fin de liste.
export const BIG_COMPETITIONS_PRIORITY = [
  "Champions League",
  "Premier League",
  "La Liga",
  "Serie A",
  "Bundesliga",
  "Ligue 1",
  "CAN (Coupe d'Afrique des Nations)",
  "Coupe du Monde FIFA",
  "Euro (Championnat d'Europe)",
  "Europa League",
  "Copa América",
  "Copa Libertadores",
  "Saudi Pro League",
  "NBA",
];

export function competitionPriority(name: string): number {
  const idx = BIG_COMPETITIONS_PRIORITY.indexOf(name);
  return idx === -1 ? BIG_COMPETITIONS_PRIORITY.length : idx;
}
