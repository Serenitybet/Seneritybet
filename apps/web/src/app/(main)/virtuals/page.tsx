export default function VirtualsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-black text-txt-primary">Sports Virtuels</h1>

      <div className="flex flex-col items-center justify-center py-20 text-center bg-bg-card border border-bg-border rounded-2xl">
        <span className="text-6xl mb-4">🎮</span>
        <h2 className="text-xl font-bold text-txt-primary mb-2">Bientôt disponible</h2>
        <p className="text-txt-muted text-sm max-w-md leading-relaxed">
          Les sports virtuels arrivent prochainement sur Serenitybet — football virtuel,
          courses de chevaux, basketball et bien plus, disponibles 24h/24.
        </p>
        <div className="flex items-center gap-2 mt-6 bg-green-600/10 border border-green-600/20 rounded-xl px-4 py-3">
          <span className="text-green-400 text-sm font-semibold">🔔 Soyez notifié au lancement</span>
        </div>
      </div>
    </div>
  );
}
