import { motion } from "framer-motion";
import type { ReactNode } from "react";

export function MetricCard(props: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "alert";
}) {
  return (
    <motion.article
      className={`metric-card ${props.tone === "alert" ? "alert-tone" : ""}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.24 }}
    >
      <div className="metric-icon">{props.icon}</div>
      <div>
        <p>{props.label}</p>
        <strong>{props.value}</strong>
        <span>{props.hint}</span>
      </div>
    </motion.article>
  );
}

