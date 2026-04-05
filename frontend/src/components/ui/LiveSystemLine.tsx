import { useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "./time";

export function LiveSystemLine({ lastUpdated }: { lastUpdated: number | null }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hero-live-line">
      <span className="system-dot-wrap inline">
        <span className="system-pulse-dot" />
        <strong>Live System Active</strong>
      </span>
      <span>
        Last updated {lastUpdated ? `${formatDistanceToNowStrict(lastUpdated)} ago` : "0s ago"} | Auto-reallocating
      </span>
    </div>
  );
}
