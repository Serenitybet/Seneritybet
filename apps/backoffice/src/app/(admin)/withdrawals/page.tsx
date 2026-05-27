"use client";

import { formatXAF } from "@serenitybet/shared";
import toast from "react-hot-toast";

const DEMO_WITHDRAWALS = [
  { id: "1", user: "@mbaye_d",  name: "Mbaye Diop",    amount: 20000,  method: "Orange Money",  account: "+235 66 XX XX XX", date: "14:10", kyc: "APPROVED" },
  { id: "2", user: "@aisha_m",  name: "Aisha Moussa",  amount: 7500,   method: "Airtel Money",  account: "+235 90 XX XX XX", date: "11:30", kyc: "APPROVED" },
  { id: "3", user: "@jean_p",   name: "Jean Pierre",   amount: 5000,   method: "Moov Money",    account: "+235 62 XX XX XX", date: "09:15", kyc: "REJECTED" },
];

export default function WithdrawalsPage() {
  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">↑ En attente</div>
          <div className="kpi-value text-orange-400">{DEMO_WITHDRAWALS.length}</div>
          <div className="kpi-delta text-t-faint">Requêtes à traiter</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">💰 Montant total</div>
          <div className="kpi-value text-t-primary">{formatXAF(DEMO_WITHDRAWALS.reduce((a, w) => a + w.amount, 0) * 100)}</div>
          <div className="kpi-delta text-t-faint">En attente d'approbation</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">✓ Traités aujourd'hui</div>
          <div className="kpi-value text-green-400">18</div>
          <div className="kpi-delta text-green-400">{formatXAF(18600 * 100)} distribués</div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bo-card">
        <div className="bo-card-header">
          <span className="bo-card-title">↕ Demandes de retrait en attente</span>
          <span className="bo-badge-orange">{DEMO_WITHDRAWALS.length} en attente</span>
        </div>
        <table className="bo-table">
          <thead>
            <tr>
              <th>Utilisateur</th>
              <th>Montant</th>
              <th>Méthode</th>
              <th>Compte / Numéro</th>
              <th>Demande le</th>
              <th>KYC</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_WITHDRAWALS.map((w) => {
              const kycOk = w.kyc === "APPROVED";
              return (
                <tr key={w.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-green-500/10 flex items-center justify-center text-[10px] text-green-400 font-bold shrink-0">
                        {w.name.split(" ").map(n => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-t-primary font-medium">{w.name}</p>
                        <p className="text-t-faint text-[10px]">{w.user}</p>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono font-bold text-green-400">{formatXAF(w.amount * 100)}</td>
                  <td className="text-t-muted">{w.method}</td>
                  <td><span className="font-mono text-[11px] text-t-faint">{w.account}</span></td>
                  <td className="text-t-faint">{w.date}</td>
                  <td>
                    {kycOk
                      ? <span className="bo-badge-green">✓ Vérifié</span>
                      : <span className="bo-badge-red">✕ Non vérifié</span>
                    }
                  </td>
                  <td>
                    {kycOk ? (
                      <div className="flex gap-1.5">
                        <button className="bo-btn-primary bo-btn-sm" onClick={() => toast.success(`Retrait approuvé — ${w.name} ✓`)}>
                          ✓ Approuver
                        </button>
                        <button className="bo-btn-danger bo-btn-sm" onClick={() => toast.error(`Retrait refusé — ${w.name}`)}>
                          ✕ Refuser
                        </button>
                      </div>
                    ) : (
                      <button className="bo-btn-secondary bo-btn-sm opacity-50 cursor-not-allowed" disabled>
                        🔒 KYC requis
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
