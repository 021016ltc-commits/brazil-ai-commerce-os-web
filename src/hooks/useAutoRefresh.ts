"use client";

import { useEffect, useRef } from "react";

type RefreshCallback = () => void | Promise<void>;

export function useAutoRefresh(callback: RefreshCallback, intervalMs = 60000) {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    let running = false;

    const tick = () => {
      if (document.visibilityState !== "visible" || running) return;

      running = true;
      Promise.resolve(callbackRef.current())
        .catch(() => undefined)
        .finally(() => {
          running = false;
        });
    };

    const intervalId = window.setInterval(tick, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [intervalMs]);
}
