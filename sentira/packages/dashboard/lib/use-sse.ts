"use client";

import { useEffect, useRef, useCallback } from "react";
import { sseUrl } from "./middleware-api";
import type { SseEvent } from "@sentira/types";

type SseHandler = (event: SseEvent) => void;

export function useSse(handler: SseHandler, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) esRef.current.close();
    const es = new EventSource(sseUrl());
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as SseEvent;
        handlerRef.current(parsed);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    connect();
    return () => {
      if (esRef.current) esRef.current.close();
    };
  }, [enabled, connect]);
}
