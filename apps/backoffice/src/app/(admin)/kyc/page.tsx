"use client";

import toast from "react-hot-toast";

const DEMO_KYC = [
  { id: "1", user: "@fatou_k",  name: "Fatou Koné",    doc: "carte_nationale_fatou.jpg", date: "18 mar 2026", type: "CNI",       color: "text-orange-400 bg-orange-500/10" },
  { id: "2", user: "@omar_s",   name: "Omar Saleh",    doc: "passeport_omar.pdf",         date: "21 mar 2026", type: "Passeport", color: "text-blue-400 bg-blue-500/10" },
  { id: "3", user: "@aisha_m",  name: "Aisha Moussa",  doc: "permis_aisha.jpg",           date: "25 mar 2026", type: "Permis",    color: "text-green-400 bg-green-500/10" },
  { id: "4", user: "@hassan_b", name: "Hassan Boukar", doc: "cni_hassan.jpg",             date: "26 mar 2026", type: "CNI",       color: "text-t-muted bg-bo-surface" },
  { id: "5", user: "@roukia_t", name: "Roukia Tahir",  doc: "passeport_roukia.pdf",       date: "27 mar 2026", type: "Passeport", color: "text-orange-400 bg-orange-500/10" },
];

export default function KycPage() {
  return (
    <div className="space-y-5">
      {/* Stat */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">🪪 En attente</div>
          <div className="kpi-value text-orange-400">{DEMO_KYC.length}</div>
          <div className="kpi-delta text-t-faint">À valider</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✓ Approuvés ce mois</div>
          <div className="kpi-value text-green-400">142</div>
          <div className="kpi-delta text-green-400">↑ +18% vs mois dernier</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✕ Rejetés ce mois</div>
          <div className="kpi-value text-red-400">23</div>
          <div className="kpi-delta text-t-faint">Documents invalides</div>
        </div>
      </div>

      {/* Tableau KYC en attente */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">🪪 Vérifications KYC en attente</span>
          <span className="bo-badge-orange">{DEMO_KYC.length} en attente</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Document soumis</th>
              <th>Date soumission</th>
              <th>Type</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_KYC.map((k) => (
              <tr key={k.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${k.color}`}>
                      {k.name.split(" ").map(w => w[0]).join("")}
                    </div>
                    <div>
                      <p className="text-t-primary font-medium">{k.name}</p>
                      <p className="text-t-faint text-[10px]">{k.user}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="font-mono text-[11px] text-t-muted bg-bo-surface border border-bo-border2 rounded px-2 py-0.5">
                    📄 {k.doc}
                  </span>
                </td>
                <td className="text-t-faint">{k.date}</td>
                <td>
                  <span className="bo-badge-yellow">{k.type}</span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="bo-btn-secondary bo-btn-sm" onClick={() => toast(`Visualisation de ${k.doc}`)}>
                      👁 Voir doc
                    </button>
                    <button className="bo-btn-primary bo-btn-sm" onClick={() => toast.success(`KYC approuvé — ${k.name} ✓`)}>
                      ✓ Approuver
                    </button>
                    <button className="bo-btn-danger bo-btn-sm" onClick={() => toast.error(`KYC rejeté — ${k.name}`)}>
                      ✕ Rejeter
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
