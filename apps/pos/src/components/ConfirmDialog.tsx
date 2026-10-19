"use client";

import { useCallback, useState, type ReactNode } from "react";

interface ConfirmState {
  message: ReactNode;
  resolve: (ok: boolean) => void;
}

// Remplace window.confirm() : le dialogue natif du navigateur affiche
// toujours l'origine du site ("xxx.com indique"), ce qui n'a pas sa place
// sur un TPE. Celui-ci est entièrement dans l'appli, sans cet habillage.
export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: ReactNode) => {
    return new Promise<boolean>((resolve) => {
      setState({ message, resolve });
    });
  }, []);

  function answer(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  const ConfirmDialog = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5">
        <div className="text-sm text-gray-700 whitespace-pre-line mb-5">{state.message}</div>
        <div className="flex gap-3">
          <button
            onClick={() => answer(false)}
            className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 font-bold"
          >
            Annuler
          </button>
          <button
            onClick={() => answer(true)}
            className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold"
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
