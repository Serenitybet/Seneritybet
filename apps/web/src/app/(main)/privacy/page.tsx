import Link from "next/link";

const SECTIONS = [
  {
    title: "1. Responsable du traitement",
    content: `Serenitybet, société exploitant une plateforme de paris sportifs sous licence au Tchad, est responsable du traitement de vos données personnelles. Pour toute question relative à la protection de vos données, contactez notre Délégué à la Protection des Données (DPD) à l'adresse : privacy@serenitybet.td`,
  },
  {
    title: "2. Données collectées",
    content: `Nous collectons les données suivantes : (a) Données d'identification : nom, prénom, date de naissance, email, numéro de téléphone ; (b) Données KYC : copie de pièce d'identité, justificatif de domicile ; (c) Données financières : transactions Mobile Money, historique des mises ; (d) Données de navigation : adresse IP, type d'appareil, logs de connexion.`,
  },
  {
    title: "3. Finalités du traitement",
    content: `Vos données sont utilisées pour : (a) Gestion de votre compte et vérification d'identité (KYC) ; (b) Traitement des dépôts et retraits via Mobile Money ; (c) Détection et prévention des fraudes ; (d) Respect de nos obligations légales (lutte contre le blanchiment) ; (e) Amélioration de nos services et personnalisation de l'expérience.`,
  },
  {
    title: "4. Base légale",
    content: `Le traitement de vos données repose sur : (a) L'exécution du contrat vous liant à Serenitybet ; (b) Le respect d'obligations légales (KYC, LCB-FT) ; (c) Votre consentement pour les communications marketing (révocable à tout moment) ; (d) Notre intérêt légitime pour la sécurité de la plateforme.`,
  },
  {
    title: "5. Conservation des données",
    content: `Vos données personnelles sont conservées pendant la durée d'activité de votre compte, augmentée de 5 ans après sa clôture, conformément aux obligations légales en vigueur au Tchad. Les données KYC sont conservées 10 ans après la fin de la relation contractuelle.`,
  },
  {
    title: "6. Partage des données",
    content: `Serenitybet ne vend jamais vos données personnelles à des tiers. Nous partageons uniquement les données nécessaires avec : (a) Nos prestataires de paiement Mobile Money (Airtel, Orange, Moov) pour le traitement des transactions ; (b) Les autorités de régulation et de contrôle sur demande légale ; (c) Nos prestataires techniques (hébergement cloud sécurisé).`,
  },
  {
    title: "7. Sécurité",
    content: `Nous mettons en œuvre des mesures techniques et organisationnelles adaptées : chiffrement des données en transit (TLS 1.3) et au repos, contrôle d'accès strict basé sur les rôles, journalisation des accès, tests de sécurité réguliers. Les mots de passe sont hachés avec bcrypt (coût 12).`,
  },
  {
    title: "8. Vos droits",
    content: `Conformément à la réglementation applicable, vous disposez des droits suivants : droit d'accès, de rectification, d'effacement (dans les limites légales), d'opposition, de portabilité et de limitation du traitement. Pour exercer ces droits, adressez votre demande à privacy@serenitybet.td avec une copie de votre pièce d'identité.`,
  },
  {
    title: "9. Cookies",
    content: `Nous utilisons des cookies strictement nécessaires au fonctionnement de la plateforme (session, sécurité CSRF) et des cookies analytiques anonymisés pour améliorer nos services. Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.`,
  },
  {
    title: "10. Modifications",
    content: `Serenitybet se réserve le droit de mettre à jour cette politique à tout moment. En cas de modification substantielle, vous serez informé par email ou notification sur la plateforme. La date de dernière mise à jour est indiquée en haut de ce document.`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      <div className="bg-bg-secondary border border-bg-border rounded-2xl p-6">
        <h1 className="text-xl font-black text-txt-primary mb-1">
          Politique de Confidentialité
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
          Contact DPD :{" "}
          <a href="mailto:privacy@serenitybet.td" className="text-green-400 hover:underline">
            privacy@serenitybet.td
          </a>
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-txt-muted">
          <Link href="/terms" className="hover:text-green-400 transition-colors">CGU</Link>
          <span>·</span>
          <Link href="/responsible-gaming" className="hover:text-green-400 transition-colors">Jeu responsable</Link>
        </div>
      </div>
    </div>
  );
}
