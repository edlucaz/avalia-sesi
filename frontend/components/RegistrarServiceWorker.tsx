"use client";

import { useEffect } from "react";

export default function RegistrarServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline sem service worker ainda funciona pra quem já tem a página em cache do navegador — só não pré-carrega o shell.
    });
  }, []);

  return null;
}
