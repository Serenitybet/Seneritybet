import Link from "next/link";

const LIMITS = [
  {
    icon: "💰",
    title: "Limites de dépôt",
    desc: "Fixez un plafond journalier, hebdomadaire ou mensuel sur vos dépôts pour maîtriser votre budget.",
  },
  {
    icon: "⏱️",
    title: "Limites de temps",
    desc: "Définissez une durée maximale de session de jeu et recevez une alerte quand vous l'atteignez.",
  },
  {
    icon: "❄️",
    title: "Pause de jeu",
    desc: "Suspendez votre compte pour 24 h, 7 jours ou 30 jours. La pause est immédiate et irrévocable pendant la durée choisie.",
  },
  {
    icon: "🚫",
    title: "Auto-exclusion",
    desc: "Excluez-vous définitivement ou pour une longue durée (6 mois, 1 an, 5 ans). Contactez le support pour activer cette option.",
  },
];

const SIGNS = [
  "Vous jouez avec l'argent destiné aux dépenses essentielles (loyer, nourriture, école…)",
  "Vous vous sentez obligé de jouer de plus en plus pour ressentir les mêmes émotions",
  "Vous tentez de récupérer vos pertes en jouant davantage",
  "Vous mentez à vos proches sur vos habitudes de jeu",
  "Le jeu interfère avec votre travail, études ou vie sociale",
  "Vous ressentez anxiété ou irritabilité quand vous ne pouvez pas jouer",
];

export default function ResponsibleGamingPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Hero */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6 text-center">
        <span className="text-5xl">🛡️</span>
        <h1 className="text-xl font-black text-txt-primary mt-3 mb-2">Jeu Responsable</h1>
        <p className="text-txt-muted text-sm leading-relaxed max-w-lg mx-auto">
          Serenitybet s'engage à offrir un environnement de jeu sûr et divertissant.
          Le jeu doit rester un loisir — nous mettons à votre disposition des outils
          pour vous aider à garder le contrôle.
        </p>
      </div>

      {/* Message âge */}
      <div className="flex items-start gap-3 bg-live/5 border border-live/20 rounded-xl p-4">
        <span className="text-2xl shrink-0">🔞</span>
        <div>
          <p className="text-sm font-semibold text-txt-primary mb-0.5">Jeu réservé aux +18 ans</p>
          <p className="text-xs text-txt-muted leading-relaxed">
            Les paris sportifs sont strictement interdits aux mineurs. Serenitybet vérifie l'âge
            lors de l'inscription (KYC) et se réserve le droit de suspendre tout compte
            dont le titulaire serait mineur.
          </p>
        </div>
      </div>

      {/* Outils disponibles */}
      <div>
        <h2 className="text-sm font-bold text-txt-primary mb-3 uppercase tracking-wider">
          Vos outils de protection
        </h2>
        <div className="space-y-2">
          {LIMITS.map((item) => (
            <div key={item.title} className="bg-bg-card border border-bg-border rounded-xl p-4 flex gap-3">
              <span className="text-xl shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-txt-primary mb-0.5">{item.title}</p>
                <p className="text-xs text-txt-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Link
            href="/account/security"
            className="btn-green inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold"
          >
            ⚙️ Gérer mes limites de jeu
          </Link>
        </div>
      </div>

      {/* Signes d'alerte */}
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-5">
        <h2 className="text-sm font-bold text-txt-primary mb-3">
          ⚠️ Signes d'une pratique problématique
        </h2>
        <p className="text-xs text-txt-muted mb-4 leading-relaxed">
          Consultez un professionnel si vous vous reconnaissez dans un ou plusieurs de ces signes :
        </p>
        <ul className="space-y-2">
          {SIGNS.map((sign, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-live text-xs mt-0.5 shrink-0">●</span>
              <span className="text-xs text-txt-secondary leading-relaxed">{sign}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Aide externe */}
      <div className="bg-bg-card border border-bg-border rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-txt-primary">📞 Besoin d'aide ?</h2>
        <p className="text-xs text-txt-muted leading-relaxed">
          Si vous ou un proche êtes concerné par une dépendance au jeu, n'hésitez pas à
          contacter notre équipe de support ou un organisme spécialisé.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a
            href="mailto:support@serenitybet.td"
            className="flex items-center gap-2 bg-bg-secondary border border-bg-border rounded-xl p-3 hover:border-green-600/40 transition-colors"
          >
            <span className="text-xl">✉️</span>
            <div>
              <p className="text-xs font-semibold text-txt-primary">Support Serenitybet</p>
              <p className="text-[11px] text-txt-muted">support@serenitybet.td</p>
            </div>
          </a>
          <div className="flex items-center gap-2 bg-bg-secondary border border-bg-border rounded-xl p-3">
            <span className="text-xl">📱</span>
            <div>
              <p className="text-xs font-semibold text-txt-primary">Ligne d'aide (Tchad)</p>
              <p className="text-[11px] text-txt-muted">Disponible 24h/24</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-center text-[11px] text-txt-muted pb-4">
        Serenitybet opère sous licence de jeux au Tchad et s'engage à respecter
        toutes les obligations légales en matière de jeu responsable.
      </p>
    </div>
  );
}
