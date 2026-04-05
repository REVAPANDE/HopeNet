import type { SystemEventRecord } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? "http://127.0.0.1:8000/api" : "/api");

function streamUrl() {
  if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
    return `${API_BASE}/system/stream`;
  }
  return `${window.location.origin}${API_BASE}/system/stream`;
}

export function subscribeSystemEvents(onEvent: (event: SystemEventRecord) => void, onError?: () => void) {
  const source = new EventSource(streamUrl());
  source.addEventListener("system_event", (message) => {
    const payload = JSON.parse((message as MessageEvent<string>).data) as SystemEventRecord;
    onEvent(payload);
  });
  source.onerror = () => {
    onError?.();
  };

  return () => source.close();
}

