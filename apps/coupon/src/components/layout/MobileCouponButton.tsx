"use client";

import { useEffect, useState } from "react";
import { useCouponStore } from "@/store/coupon.store";
import { CouponPanel } from "./CouponPanel";

export function MobileCouponButton() {
  const { selections, totalOdds } = useCouponStore();
  const [open, setOpen] = useState(false);
  // Le bouton flottant apparaît pile là où le pouce vient de taper une cote
  // (coïncidence fréquente en bas d'écran) — un navigateur mobile peut alors
  // livrer le clic au nouvel élément apparu sous le doigt entre le
  // touchstart et le touchend ("ghost click"), ouvrant le tiroir sans que
  // l'utilisateur l'ait vraiment voulu. On le rend cliquable seulement après
  // un court délai pour éliminer ce risque.
  const [canOpen, setCanOpen] = useState(false);

  useEffect(() => {
    if (selections.length === 0) { setCanOpen(false); return; }
    const t = setTimeout(() => setCanOpen(true), 400);
    return () => clearTimeout(t);
  }, [selections.length]);

  // Ne jamais démonter ce composant tant que le tiroir est ouvert : après
  // l'enregistrement, clearSlip() vide les sélections — si on se basait
  // uniquement sur selections.length ici, tout le tiroir (et donc l'écran
  // affichant le code du coupon) disparaîtrait instantanément.
  if (selections.length === 0 && !open) return null;

  return (
    <>
      {selections.length > 0 && (
        <button
          onClick={() => canOpen && setOpen(true)}
          className="fixed bottom-20 right-4 z-40 md:hidden flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-full shadow-xl shadow-green-900/40 font-bold text-sm active:scale-95 transition-transform"
        >
          <span className="w-5 h-5 bg-white text-green-600 rounded-full text-xs font-black flex items-center justify-center">
            {selections.length}
          </span>
          <span>Mon coupon</span>
          <span className="text-green-200 font-mono">x{totalOdds.toFixed(2)}</span>
        </button>
      )}

      {open && (
        // z-[60] : doit passer au-dessus de BottomNav (z-50), sans quoi la
        // barre de navigation du bas — rendue après dans le DOM, donc
        // gagnante à z-index égal — recouvre en permanence le bas du tiroir
        // (et donc le bouton "Enregistrer mon coupon").
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* flex-col + hauteur bornée (pas de overflow-y-auto directement
              ici) : CouponPanel gère son propre défilement interne (liste des
              sélections uniquement), pour que le bouton "Enregistrer" reste
              toujours visible en bas du tiroir, quel que soit le nombre de
              sélections. dvh (et non vh) : sur mobile, "vh" se base sur la
              hauteur maximale théorique de l'écran, pas sur la zone
              réellement visible une fois la barre d'adresse du navigateur
              repliée/dépliée — avec beaucoup de sélections (6-7+), le tiroir
              pouvait alors dépasser l'écran réel et pousser le bouton
              "Enregistrer" hors champ, impossible à faire défiler pour le
              retrouver (signalé en prod le 30/10/2026). "dvh" (dynamic
              viewport height) se recalcule en fonction de l'espace vraiment
              visible à cet instant. */}
          <div className="absolute bottom-0 left-0 right-0 bg-bg-secondary rounded-t-2xl max-h-[85dvh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-bg-border shrink-0">
              <span className="font-bold text-txt-primary">Mon coupon{selections.length > 0 ? ` (${selections.length})` : ""}</span>
              <button onClick={() => setOpen(false)} className="text-txt-muted text-2xl leading-none">
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <CouponPanel />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
