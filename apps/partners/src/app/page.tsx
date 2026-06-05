import Link from "next/link";

export default function LandingPage() {
  const STEPS = [
    { num: "01", title: "Inscrivez-vous", desc: "Créez votre compte partenaire gratuitement en quelques minutes.", icon: "✍️" },
    { num: "02", title: "Obtenez votre code", desc: "Recevez votre code promo personnalisé (ex: STAR-CESAIRE).", icon: "🎫" },
    { num: "03", title: "Partagez", desc: "Partagez votre code sur vos réseaux sociaux et à vos fans.", icon: "📱" },
    { num: "04", title: "Gagnez des commissions", desc: "Touchez jusqu'à 30% sur les pertes de vos filleuls.", icon: "💰" },
  ];

  const BENEFITS = [
    { icon: "💸", title: "Jusqu'à 30% de commission", desc: "Revenus récurrents chaque semaine sur les pertes nettes de vos filleuls" },
    { icon: "📊", title: "Dashboard en temps réel", desc: "Suivez vos filleuls, commissions et statistiques en direct" },
    { icon: "🎫", title: "Code promo personnalisé", desc: "Un code à votre image, facile à mémoriser et partager" },
    { icon: "💳", title: "Paiement rapide", desc: "Retraits via Airtel Money, Orange Money ou Moov Money" },
    { icon: "🤝", title: "Support dédié", desc: "Une équipe à votre disposition pour vous accompagner" },
    { icon: "🌍", title: "Ouvert à tous", desc: "Artistes, influenceurs, stars, sportifs tchadiens — rejoignez-nous" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center font-black text-white text-lg">S</div>
          <div>
            <p className="font-black text-white text-sm leading-tight">
              <span className="text-green-400">Serenity</span>bet
            </p>
            <p className="text-[9px] text-gray-500 uppercase tracking-wider">Partners</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
            Connexion
          </Link>
          <Link href="/register" className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            Devenir partenaire
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-24 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-green-600/10 border border-green-600/30 rounded-full px-4 py-1.5 text-green-400 text-sm font-medium mb-6">
          🌍 Programme d'affiliation — Tchad
        </div>
        <h1 className="text-4xl sm:text-6xl font-black text-white mb-6 leading-tight">
          Gagnez de l'argent avec<br/>
          <span className="text-green-400">Serenitybet</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Devenez partenaire officiel Serenitybet. Partagez votre code promo,
          recrutez des parieurs et touchez des commissions chaque semaine.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register"
            className="bg-green-600 hover:bg-green-700 text-white font-black text-lg px-8 py-4 rounded-xl transition-colors">
            Commencer gratuitement →
          </Link>
          <Link href="/login"
            className="border border-gray-700 hover:border-green-600/50 text-gray-300 font-semibold text-lg px-8 py-4 rounded-xl transition-colors">
            Déjà partenaire ? Se connecter
          </Link>
        </div>
        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mt-16">
          {[
            { val: "30%", label: "Commission max." },
            { val: "24h", label: "Délai de paiement" },
            { val: "100%", label: "Gratuit à rejoindre" },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black text-green-400">{s.val}</p>
              <p className="text-sm text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="px-6 py-16 bg-gray-900/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-12">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(step => (
              <div key={step.num} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 text-center hover:border-green-600/40 transition-colors">
                <div className="text-4xl mb-3">{step.icon}</div>
                <div className="text-green-400 text-xs font-bold uppercase tracking-wider mb-2">{step.num}</div>
                <h3 className="font-black text-white mb-2">{step.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Avantages */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-black text-center text-white mb-4">Pourquoi nous rejoindre ?</h2>
          <p className="text-center text-gray-400 mb-12">Tout ce dont vous avez besoin pour monétiser votre audience</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map(b => (
              <div key={b.title} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:border-green-600/30 transition-colors">
                <div className="text-3xl mb-3">{b.icon}</div>
                <h3 className="font-bold text-white mb-1">{b.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="px-6 py-16 text-center">
        <div className="max-w-2xl mx-auto bg-gradient-to-r from-green-900/40 to-green-600/20 border border-green-600/30 rounded-3xl p-10">
          <h2 className="text-3xl font-black text-white mb-4">Prêt à commencer ?</h2>
          <p className="text-gray-400 mb-8">Rejoignez les partenaires Serenitybet et commencez à gagner dès aujourd'hui.</p>
          <Link href="/register"
            className="bg-green-600 hover:bg-green-700 text-white font-black text-lg px-8 py-4 rounded-xl transition-colors inline-block">
            Créer mon compte partenaire →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-6 text-center text-sm text-gray-500">
        © 2026 Serenitybet — Programme Partenaires · Licence de jeux Tchad
      </footer>
    </div>
  );
}
