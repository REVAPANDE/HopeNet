import { motion, AnimatePresence } from "framer-motion";

export function SimulationOverlay({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="simulation-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="simulation-overlay-card"
            initial={{ scale: 0.96, opacity: 0.5 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            <div className="spinner-ring" />
            <strong>Simulating scenario...</strong>
            <span>Recomputing allocation, coverage, and fairness impact.</span>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

