import { EventCard } from "@/components/sports/EventCard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

async function getLiveEvents() {
  try {
    const res = await fetch(`${API_URL}/sports/events?status=LIVE&limit=30`, { cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return json.data?.events ?? [];
  } catch {
    return [];
  }
}

const DEMO_LIVE = [
  { sport: "⚽", comp: "Ligue des Champions", t1: "Real Madrid",   t2: "Bayern Munich",  min: "67", score: "2-1" },
  { sport: "⚽", comp: "Premier League",      t1: "Man City",      t2: "Liverpool",      min: "34", score: "1-1" },
  { sport: "🏀", comp: "NBA",                 t1: "Lakers",        t2: "Celtics",        min: "Q3", score: "78-82" },
  { sport: "⚽", comp: "La Liga",             t1: "Atlético",      t2: "Barça",          min: "55", score: "0-1" },
];

export default async function LivePage() {
  const events = await getLiveEvents();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 bg-live rounded-full animate-pulse" />
        <h1 className="text-lg font-black text-txt-primary">Paris en direct</h1>
        <span className="badge-live ml-1">{events.length || DEMO_LIVE.length} live</span>
      </div>

      {events.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-bg-border divide-y divide-bg-border">
          {events.map((ev: any) => <EventCard key={ev.id} event={ev} />)}
        </div>
      ) : (
        <>
          {/* Démo */}
          <div className="space-y-2">
            {DEMO_LIVE.map((m, i) => (
              <div key={i} className="bg-bg-card border border-bg-border rounded-xl p-3 hover:bg-bg-hover transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs">{m.sport}</span>
                  <span className="text-[11px] text-txt-muted">{m.comp}</span>
                  <span className="ml-auto badge-live">
                    <span className="w-1.5 h-1.5 bg-live rounded-full animate-pulse" />
                    {m.min}&apos;
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-bold text-txt-primary">{m.t1}</p>
                    <p className="text-sm font-bold text-txt-primary">{m.t2}</p>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-live/10 border border-live/30 rounded-lg px-3 py-1.5 min-w-[44px]">
                    {m.score.split("-").map((s, j) => (
                      <span key={j} className="text-lg font-black text-live leading-none">{s}</span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {["1.85","3.20","2.10"].map((odd, j) => (
                      <button key={j} className="odd-btn">
                        <span className="odd-label">{["1","X","2"][j]}</span>
                        <span className="odd-value">{odd}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-txt-muted py-2">
            Les cotes en direct seront disponibles une fois la clé TheOddsAPI configurée.
          </p>
        </>
      )}
    </div>
  );
}
