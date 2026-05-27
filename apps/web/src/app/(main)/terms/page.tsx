import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Présentation et acceptation",
    content: `Serenitybet (ci-après « la Société ») exploite une plateforme de paris sportifs agréée au Tchad. En créant un compte ou en plaçant un pari, vous acceptez sans réserve les présentes Conditions Générales d'Utilisation (CGU). Si vous n'acceptez pas ces conditions, veuillez ne pas utiliser nos services.`,
  },
  {
    title: "2. Eligibilité",
    content: `Pour utiliser les services Serenitybet, vous devez : (a) avoir au moins 18 ans révolus ; (b) résider dans un territoire où les paris sportifs en ligne sont légaux ; (c) ne pas faire l'objet d'une auto-exclusion active. La Société se réserve le droit de demander la vérification de l'identité (KYC) avant tout retrait de fonds.`,
  },
  {
    title: "3. Compte utilisateur",
    content: `Chaque utilisateur ne peut détenir qu'un seul compte. Vous êtes responsable de la confidentialité de vos identifiants. Tout accès frauduleux ou tentative de création de comptes multiples entraîne la suspension immédiate du ou des comptes concernés et la confiscation des fonds en cas de fraude avérée.`,
  },
  {
    title: "4. Dépôts et retraits",
    content: `Les dépôts sont effectués via Airtel Money, Orange Money ou Moov Money (Flooz). Le montant minimum de dépôt est de 500 XAF. Les retraits sont soumis à vérification KYC complète. La Société traite les demandes de retrait dans un délai de 24 à 72 heures ouvrables. Le montant minimum de retrait est de 1 000 XAF.`,
  },
  {
    title: "5. Paris sportifs",
    content: `Les cotes affichées peuvent être modifiées jusqu'au coup d'envoi de l'événement. Tout pari validé est définitif. En cas d'annulation d'un événement, les mises sont remboursées (cote 1,00). Les paris dont le gain potentiel dépasse le seuil de risque configuré sont soumis à validation manuelle par notre équipe Trader.`,
  },
  {
    title: "6. Bonus et promotions",
    content: `Les bonus sont soumis à des conditions de mise spécifiques indiquées dans chaque offre. Les bonus ne peuvent pas être retirés avant satisfaction des conditions de mise. La Société se réserve le droit de modifier ou d'annuler tout bonus en cas d'abus détecté.`,
  },
  {
    title: "7. Jeu responsable",
    content: `Serenitybet s'engage à promouvoir un jeu responsable. Des outils de limitation et d'auto-exclusion sont mis à disposition de tous les utilisateurs. Le jeu ne doit pas être considéré comme une source de revenus. Si vous pensez souffrir d'une dépendance, veuillez consulter notre page Jeu Responsable ou contacter notre support.`,
  },
  {
    title: "8. Limitation de responsabilité",
    content: `La Société ne peut être tenue responsable des pertes consécutives à des pannes techniques, erreurs de transmission ou interruptions de service dues à des causes externes. Le joueur reconnaît que les paris sportifs comportent un risque de perte financière.`,
  },
  {
    title: "9. Modifications des CGU",
    content: `Serenitybet se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés par email ou via une notification sur la plateforme. La poursuite de l'utilisation des services après notification vaut acceptation des nouvelles conditions.`,
  },
  {
    title: "10. Droit applicable",
    content: `Les présentes CGU sont régies par le droit tchadien. Tout litige sera soumis à la juridiction compétente de N'Djamena, Tchad, sauf convention contraire.`,
  },
];

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6">
        <h1 className="text-xl font-black text-txt-primary mb-1">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-xs text-txt-muted">
          Dernière mise à jour : 27 mai 2026 · Serenitybet — Licence de jeux (Tchad)
        </p>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((s) => (
          <div key={s.title} className="bg-bg-card border border-bg-border rounded-xl p-4">
            <h2 className="text-sm font-bold text-txt-primary mb-2">{s.title}</h2>
            <p className="text-xs text-txt-muted leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>

      <div className="text-center space-y-2">
        <p className="text-xs text-txt-muted">
          Des questions ? Contactez-nous à{" "}
          <a href="mailto:legal@serenitybet.td" className="text-green-400 hover:underline">
            legal@serenitybet.td
          </a>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-txt-muted">
          <Link href="/privacy" className="hover:text-green-400 transition-colors">Politique de confidentialité</Link>
          <span>·</span>
          <Link href="/responsible-gaming" className="hover:text-green-400 transition-colors">Jeu responsable</Link>
        </div>
      </div>
    </div>
  );
}
