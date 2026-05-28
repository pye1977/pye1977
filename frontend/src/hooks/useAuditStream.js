import { useEffect, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

/**
 * Subscribes to /api/ws/audit and yields the latest N events for live UI updates.
 * No reconnection back-off thrashing — simple retry after 4s on failure.
 */
export default function useAuditStream(limit = 20) {
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let retryHandle = null;
    const url = `${BACKEND_URL.replace(/^http/, "ws")}/api/ws/audit`;

    const connect = () => {
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data?.event) {
              setEvents((prev) => [data.event, ...prev].slice(0, limit));
            }
          } catch (_e) {
            /* ignore */
          }
        };
        ws.onclose = () => {
          if (cancelled) return;
          retryHandle = setTimeout(connect, 4000);
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch (_e) {
            /* ignore */
          }
        };
        // Keepalive ping
        const ping = setInterval(() => {
          try {
            ws.readyState === 1 && ws.send("ping");
          } catch (_e) {
            /* ignore */
          }
        }, 25000);
        ws.onclose = () => {
          clearInterval(ping);
          if (cancelled) return;
          retryHandle = setTimeout(connect, 4000);
        };
      } catch (_e) {
        if (cancelled) return;
        retryHandle = setTimeout(connect, 4000);
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (retryHandle) clearTimeout(retryHandle);
      try {
        wsRef.current && wsRef.current.close();
      } catch (_e) {
        /* ignore */
      }
    };
  }, [limit]);

  return events;
}
