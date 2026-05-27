import Link from "next/link";

const PROMOS = [
  {
    id: 1,
    icon: "🎁",
    badge: "BIENVENUE",
    badgeColor: "bg-green-600",
    title: "Bonus de Bienvenue 100%",
    desc: "Doublez votre premier dépôt jusqu'à 50 000 XAF. Offre réservée aux nouveaux inscrits.",
    detail: "Misez votre dépôt + bonus 1x pour débloquer. Cote minimale : 1.50.",
    cta: "S'inscrire maintenant",
    href: "/register",
    color: "from-green-900/40 to-green-600/10 border-green-600/30",
  },
  {
    id: 2,
    icon: "🛡️",
    badge: "OFFRE",
    badgeColor: "bg-blue-600",
    title: "Pari Remboursé",
    desc: "Si votre 1er pari sportif est perdant, vous êtes remboursé jusqu'à 5 000 XAF en crédit.",
    detail: "Valable sur tous les matchs. Crédit utilisable sous 7 jours.",
    cta: "En profiter",
    href: "/register",
    color: "from-blue-900/40 to-blue-600/10 border-blue-600/30",
  },
  {
    id: 3,
    icon: "⚡",
    badge: "BOOST",
    badgeColor: "bg-amber-500",
    title: "Cote Boostée du Jour",
    desc: "Chaque jour, une sélection exclusive avec une cote améliorée par nos traders.",
    detail: "Aujourd'hui : Cameroun gagne la CAN — Cote 4.50 au lieu de 3.10",
    cta: "Parier maintenant",
    href: "/",
    color: "from-amber-900/40 to-amber-600/10 border-amber-600/30",
  },
  {
    id: 4,
    icon: "🏆",
    badge: "FIDÉLITÉ",
    badgeColor: "bg-purple-600",
    title: "Programme de Fidélité",
    desc: "Gagnez des points à chaque pari. Échangez-les contre des bonus et des cadeaux exclusifs.",
    detail: "1 XAF misé = 1 point. Paliers Bronze, Argent, Or, Diamant.",
    cta: "Voir mon niveau",
    href: "/account",
    color: "from-purple-900/40 to-purple-600/10 border-purple-600/30",
  },
  {
    id: 5,
    icon: "📱",
    badge: "MOBILE",
    badgeColor: "bg-orange-500",
    title: "Bonus Dépôt Mobile Money",
    desc: "+5% sur chaque dépôt via Airtel Money, Orange Money ou Moov Money (Flooz).",
    detail: "Bonus crédité automatiquement après confirmation du paiement.",
    cta: "Déposer maintenant",
    href: "/account/wallet",
    color: "from-orange-900/40 to-orange-600/10 border-orange-600/30",
  },
  {
    id: 6,
    icon: "👥",
    badge: "PARRAINAGE",
    badgeColor: "bg-green-600",
    title: "Parrainez un ami",
    desc: "Invitez un ami à s'inscrire. Recevez 2 000 XAF dès qu'il effectue son premier dépôt.",
    detail: "Aucune limite de parrainages. Gains instantanés sur votre portefeuille.",
    cta: "Obtenir mon lien",
    href: "/account",
    color: "from-green-900/40 to-green-600/10 border-green-600/30",
  },
];

export default function PromotionsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-txt-primary">Promotions & Bonus</h1>
        <span className="text-xs text-txt-muted">{PROMOS.length} offres actives</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PROMOS.map((promo) => (
          <div
            key={promo.id}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${promo.color} p-4 hover:brightness-110 transition-all`}
          >
            <span className={`absolute top-3 right-3 text-[10px] font-black px-2 py-0.5 ${promo.badgeColor} text-white rounded-full`}>
              {promo.badge}
            </span>

            <div className="flex items-start gap-3">
              <span className="text-3xl mt-0.5">{promo.icon}</span>
              <div className="flex-1 min-w-0 pr-12">
                <h2 className="font-bold text-txt-primary text-sm mb-1">{promo.title}</h2>
                <p className="text-xs text-txt-secondary leading-relaxed mb-2">{promo.desc}</p>
                <p className="text-[11px] text-txt-muted leading-relaxed mb-3">{promo.detail}</p>
                <Link
                  href={promo.href}
                  className="inline-flex items-center gap-1 btn-green text-xs px-3 py-1.5"
                >
                  {promo.cta} →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center py-4 border-t border-bg-border">
        <p className="text-[11px] text-txt-muted">
          * Toutes les promotions sont soumises aux{" "}
          <a href="/terms" className="text-green-400 hover:underline">conditions générales</a>.
          {" "}Le jeu peut créer une dépendance — jouez de façon responsable.
        </p>
      </div>
    </div>
  );
}
