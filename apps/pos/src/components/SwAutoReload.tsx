"use client";

import { useEffect } from "react";

// `skipWaiting` + `clientsClaim` (voir next.config.ts) font qu'un nouveau
// service worker prend le contrôle immédiatement en arrière-plan — mais ça
// ne recharge pas tout seul la page déjà ouverte : le JS déjà chargé en
// mémoire continue de tourner avec l'ancienne version jusqu'à une vraie
// fermeture/réouverture de l'appli. Sur un TPE laissé ouvert toute la
// journée, ça veut dire qu'un correctif déployé côté serveur n'est jamais
// pris en compte tant que personne ne force manuellement la fermeture.
// On force ici le rechargement dès que le nouveau service worker devient
// actif, pour que les mises à jour s'appliquent vraiment sans action
// manuelle sur l'appareil.
export function SwAutoReload() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  return null;
}
