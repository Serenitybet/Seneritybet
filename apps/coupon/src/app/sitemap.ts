import type { MetadataRoute } from "next";

const SITE_URL = "https://serenitybetcode.com";

// Pages statiques seulement — les fiches match (/match/[id]) changent en
// permanence (nouveaux évènements synchronisés toutes les 5 min, matchs
// terminés retirés) : les y inclure demanderait une génération dynamique
// coûteuse pour un bénéfice SEO quasi nul, personne ne cherche un match
// précis par son URL interne.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "always", priority: 1 },
    { url: `${SITE_URL}/verifier`, changeFrequency: "daily", priority: 0.5 },
  ];
}
