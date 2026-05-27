const RESULTS = [
  { id: 1, sport: "⚽", comp: "Ligue des Champions", t1: "Chelsea",    s1: 1, t2: "PSG",        s2: 2, date: "Hier 21:00",     status: "FINISHED" },
  { id: 2, sport: "⚽", comp: "Premier League",      t1: "Arsenal",   s1: 3, t2: "Tottenham",  s2: 0, date: "Hier 18:30",     status: "FINISHED" },
  { id: 3, sport: "🏀", comp: "NBA",                 t1: "Bulls",     s1: 98,t2: "Heat",       s2: 105,date: "Hier 02:30",    status: "FINISHED" },
  { id: 4, sport: "⚽", comp: "La Liga",             t1: "Barça",     s1: 4, t2: "Valencia",   s2: 1, date: "26/05 20:00",    status: "FINISHED" },
  { id: 5, sport: "⚽", comp: "Serie A",             t1: "Inter",     s1: 2, t2: "Juventus",   s2: 2, date: "26/05 20:45",    status: "FINISHED" },
  { id: 6, sport: "🎾", comp: "Roland Garros",       t1: "Djokovic",  s1: 3, t2: "Alcaraz",    s2: 1, date: "26/05 15:00",    status: "FINISHED" },
  { id: 7, sport: "⚽", comp: "Ligue 1",             t1: "PSG",       s1: 5, t2: "Marseille",  s2: 0, date: "25/05 21:00",    status: "FINISHED" },
  { id: 8, sport: "⚽", comp: "Bundesliga",          t1: "Bayern",    s1: 3, t2: "Dortmund",   s2: 2, date: "25/05 18:30",    status: "FINISHED" },
];

export default function ResultsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black text-txt-primary">Résultats</h1>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        {["Aujourd'hui","Hier","Cette semaine","Football","Basketball","Tennis"].map((f) => (
          <button
            key={f}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              f === "Hier"
                ? "bg-green-600/20 text-green-400 border-green-600/40"
                : "bg-bg-card border-bg-border text-txt-muted hover:text-txt-primary hover:border-bg-border"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Résultats */}
      <div className="space-y-2">
        {RESULTS.map((r) => (
          <div key={r.id} className="bg-bg-card border border-bg-border rounded-xl p-3 hover:bg-bg-hover transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">{r.sport}</span>
              <span className="text-[11px] text-txt-muted">{r.comp}</span>
              <span className="ml-auto text-[11px] text-txt-muted">{r.date}</span>
              <span className="bg-bg-hover text-txt-muted text-[10px] px-1.5 py-0.5 rounded font-medium">FT</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <p className={`text-sm font-bold leading-tight ${r.s1 > r.s2 ? "text-green-400" : "text-txt-primary"}`}>
                  {r.t1}
                </p>
                <p className={`text-sm font-bold leading-tight ${r.s2 > r.s1 ? "text-green-400" : "text-txt-primary"}`}>
                  {r.t2}
                </p>
              </div>
              <div className="flex flex-col items-center justify-center bg-bg-input border border-bg-border rounded-lg px-3 py-1.5 min-w-[44px]">
                <span className={`text-base font-black leading-none ${r.s1 > r.s2 ? "text-green-400" : "text-txt-secondary"}`}>{r.s1}</span>
                <span className={`text-base font-black leading-none ${r.s2 > r.s1 ? "text-green-400" : "text-txt-secondary"}`}>{r.s2}</span>
              </div>
              <button className="text-[11px] text-txt-muted hover:text-green-400 transition-colors border border-bg-border rounded-lg px-2 py-1">
                Stats
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
