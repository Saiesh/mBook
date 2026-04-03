"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        // Why: explicit scope keeps the app shell and API routes under one worker boundary.
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        // Why: registration failures should be visible during QA without crashing the UI.
        console.error("Service worker registration failed", error);
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
