import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Activity, RefreshCcw, SlidersHorizontal, Zap, X } from "lucide-react";
import {
  useDashboardData,
  useLiveEventFeed,
  useRecomputeAllocation,
  useUpdatePriorityWeights
} from "../../features/allocation/allocationHooks";
import { useSimulation } from "../../features/simulation/simulationHooks";
import { useExplanation } from "../../features/explainability/explainabilityHooks";
import { useStore } from "../../store/useStore";
import { DashboardSkeleton } from "../../components/skeletons/DashboardSkeleton";
import { LiveStatusBanner } from "../../components/ui/LiveStatusBanner";
import { LiveSystemLine } from "../../components/ui/LiveSystemLine";
import { SystemStatusPanel } from "../../components/ui/SystemStatusPanel";
import { SimulationOverlay } from "../../components/loaders/SimulationOverlay";
import { MetricsPanel } from "./MetricsPanel";
import { AssignmentFeed } from "./AssignmentFeed";
import { SimulationPanel } from "./SimulationPanel";
import { ExplainabilityPanel } from "./ExplainabilityPanel";
import type { AllocationResponse, PriorityWeights } from "../../types";

const MapView = lazy(() => import("./MapView").then((module) => ({ default: module.MapView })));

const emptyAllocation = {
  assignments: [],
  reasons: [],
  metrics: {
    coverage_rate: 0,
    avg_distance_km: 0,
    fairness_index: 0,
    pending_critical_tasks: 0,
    volunteer_utilization: 0
  },
  unassigned_tasks: [],
  summary: ""
};

export function Dashboard() {
  const dashboardQuery = useDashboardData();
  useLiveEventFeed();
  const recomputeMutation = useRecomputeAllocation();
  const updatePriorityMutation = useUpdatePriorityWeights();
  const simulationMutation = useSimulation();
  const explanationMutation = useExplanation();
  const store = useStore();

  const [scenario, setScenario] = useState<"volunteer_dropout" | "demand_spike">("volunteer_dropout");
  const [dropoutRate, setDropoutRate] = useState(0.5);
  const [demandMultiplier, setDemandMultiplier] = useState(2.5);
  const [targetArea, setTargetArea] = useState("East Zone");
  const [activeAssignment, setActiveAssignment] = useState<{ volunteerId: string; taskId: string } | null>(null);
  const [showWeightsEditor, setShowWeightsEditor] = useState(true);
  const [actionFeedback, setActionFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [draftWeights, setDraftWeights] = useState<PriorityWeights>(
    store.priorityConfig?.weights ?? {
      skill_match: 0.2,
      distance: 0.4,
      priority: 0.3,
      availability: 0.2,
      workload_penalty: 0.1
    }
  );

  useEffect(() => {
    if (store.priorityConfig?.weights) {
      setDraftWeights(store.priorityConfig.weights);
    }
  }, [store.priorityConfig]);

  const showingSimulation = Boolean(store.simulation);
  const activeAllocation = showingSimulation
    ? store.simulation?.simulated ?? emptyAllocation
    : store.allocations ?? emptyAllocation;
  const activeTasks = showingSimulation ? store.simulation?.simulated_tasks ?? [] : store.tasks;
  const activeVolunteers = showingSimulation ? store.simulation?.simulated_volunteers ?? [] : store.volunteers;
  const areas = useMemo(() => Array.from(new Set(store.tasks.map((task) => task.area))), [store.tasks]);
  const latestEvent = store.events[0] ?? null;

  async function onRunSimulation() {
    if (scenario === "volunteer_dropout") {
      await simulationMutation.mutateAsync({ scenario, dropout_rate: dropoutRate });
      return;
    }

    await simulationMutation.mutateAsync({
      scenario,
      target_area: targetArea,
      demand_multiplier: demandMultiplier
    });
  }

  async function onExplain(volunteerId: string, taskId: string) {
    setActiveAssignment({ volunteerId, taskId });
    await explanationMutation.mutateAsync({ volunteerId, taskId });
  }

  async function onApplyWeights() {
    const previousAllocation = store.allocations;
    try {
      const result = await updatePriorityMutation.mutateAsync(draftWeights);
      const moved = countAssignmentChanges(previousAllocation, result.allocation);
      setActionFeedback({
        tone: "success",
        message: moved > 0
          ? `Priority update recomputed allocations with ${moved} reassigned task${moved === 1 ? "" : "s"}.`
          : "Priority update completed. Scores refreshed with current field state."
      });
    } catch {
      setActionFeedback({ tone: "error", message: "Priority update failed. Check backend/API connectivity." });
    }
  }

  async function onRecompute() {
    const previousAllocation = store.allocations;
    try {
      const allocation = await recomputeMutation.mutateAsync();
      const moved = countAssignmentChanges(previousAllocation, allocation);
      setActionFeedback({
        tone: "success",
        message: moved > 0
          ? `Recompute complete with ${moved} assignment shift${moved === 1 ? "" : "s"}.`
          : "Recompute completed with no reassignment needed; system remains optimal."
      });
    } catch {
      setActionFeedback({ tone: "error", message: "Recompute failed. Please retry and inspect API logs." });
    }
  }

  function countAssignmentChanges(previous: AllocationResponse | null, next: AllocationResponse | null) {
    if (!previous || !next) return 0;
    const previousByTask = new Map(previous.assignments.map((assignment) => [assignment.task_id, assignment.volunteer_id]));
    let moved = 0;
    for (const assignment of next.assignments) {
      const prevVolunteer = previousByTask.get(assignment.task_id);
      if (prevVolunteer && prevVolunteer !== assignment.volunteer_id) {
        moved += 1;
      }
    }
    return moved;
  }

  useEffect(() => {
    if (!actionFeedback) return;
    const timer = window.setTimeout(() => setActionFeedback(null), 2600);
    return () => window.clearTimeout(timer);
  }, [actionFeedback]);

  if (dashboardQuery.isLoading && !store.allocations) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="app-shell minimal-shell">
      <SimulationOverlay visible={simulationMutation.isPending} />

      <header className="top-system-bar">
        <div className="topbar-brand-block">
          <div className="topbar-brand-mark">
            <Activity size={14} />
          </div>
          <div className="topbar-brand-copy">
            <div className="topbar-brand">HopeNet Command Center</div>
            <span>Live disaster coordination</span>
          </div>
        </div>
        <nav className="topbar-nav">
          <a href="#overview">Overview</a>
          <a href="#operations">Operations</a>
          <a href="#simulation">Simulation</a>
          <a href="#decisions">Decisions</a>
        </nav>
        <div className="topbar-right">
          <LiveSystemLine lastUpdated={store.lastUpdated} />
          <div className="topbar-actions">
            <motion.button
              className="compact-action"
              onClick={() => void onRecompute()}
              disabled={recomputeMutation.isPending}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {recomputeMutation.isPending ? <span className="mini-spinner" /> : <RefreshCcw size={14} />}
              Recompute
            </motion.button>
            <motion.button
              className="compact-action secondary"
              onClick={() => void onApplyWeights()}
              disabled={updatePriorityMutation.isPending}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {updatePriorityMutation.isPending ? <span className="mini-spinner" /> : <Zap size={14} />}
              Update Priorities
            </motion.button>
            <motion.button
              className="compact-action tertiary"
              onClick={() => setShowWeightsEditor((value) => !value)}
              whileHover={{ y: -1, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {showWeightsEditor ? <X size={14} /> : <SlidersHorizontal size={14} />}
              {showWeightsEditor ? "Hide Weights" : "Tune Weights"}
            </motion.button>
          </div>
        </div>
      </header>

      <main className="shell clean-shell">
        {actionFeedback ? (
          <section className={`action-feedback ${actionFeedback.tone}`}>
            <strong>{actionFeedback.tone === "success" ? "Action successful" : "Action failed"}</strong>
            <span>{actionFeedback.message}</span>
          </section>
        ) : null}

        {showWeightsEditor ? (
          <section className="panel weight-editor" id="overview">
            <div className="section-header">
              <span>Priority Model Controls</span>
            </div>
            <div className="weight-grid">
              {(
                [
                  ["skill_match", "Skill match"],
                  ["distance", "Distance"],
                  ["priority", "Priority"],
                  ["availability", "Availability"],
                  ["workload_penalty", "Workload penalty"]
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="weight-control">
                  <span>{label}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={draftWeights[key]}
                    onChange={(event) =>
                      setDraftWeights((current) => ({
                        ...current,
                        [key]: Number(event.target.value)
                      }))
                    }
                  />
                  <strong>{draftWeights[key].toFixed(2)}</strong>
                </label>
              ))}
            </div>
            <div className="weight-actions">
              <button className="mode-chip" onClick={() => setDraftWeights(store.priorityConfig?.weights ?? draftWeights)}>
                Reset Draft
              </button>
              <button className="primary-button" onClick={() => void onApplyWeights()}>
                {updatePriorityMutation.isPending ? "Saving weights..." : "Apply and Recompute"}
              </button>
            </div>
          </section>
        ) : null}

        <LiveStatusBanner
          isLive={store.isLive}
          isRecomputing={store.isRecomputing}
          isFetching={dashboardQuery.isFetching || recomputeMutation.isPending || updatePriorityMutation.isPending}
          lastUpdated={store.lastUpdated}
          triggerReason={store.triggerReason}
          onToggleLive={() => useStore.getState().setLive(!store.isLive)}
        />

        <MetricsPanel allocation={activeAllocation} />

        <SystemStatusPanel
          triggerReason={store.triggerReason}
          eventCount={store.events.length}
          latestEvent={latestEvent}
          isRecomputing={store.isRecomputing || recomputeMutation.isPending || updatePriorityMutation.isPending}
        />

        <section className="operations-layout" id="operations">
          <Suspense fallback={<div className="map-surface loading" />}>
            <MapView
              tasks={activeTasks}
              volunteers={activeVolunteers}
              allocation={activeAllocation}
              highlightedArea={showingSimulation && scenario === "demand_spike" ? targetArea : null}
              isSimulated={showingSimulation}
            />
          </Suspense>

          <aside className="operations-side" id="decisions">
            <AssignmentFeed
              allocation={activeAllocation}
              tasks={activeTasks}
              volunteers={activeVolunteers}
              lastUpdated={store.lastUpdated}
              triggerReason={store.triggerReason}
              onExplain={(volunteerId, taskId) => void onExplain(volunteerId, taskId)}
            />
            <ExplainabilityPanel
              explanation={explanationMutation.data?.explanation ?? ""}
              detail={explanationMutation.data?.detail ?? null}
              isPending={explanationMutation.isPending}
              onRegenerate={() =>
                activeAssignment
                  ? void onExplain(activeAssignment.volunteerId, activeAssignment.taskId)
                  : undefined
              }
            />
          </aside>
        </section>

        <section className="simulation-strip" id="simulation">
          <SimulationPanel
            scenario={scenario}
            setScenario={setScenario}
            dropoutRate={dropoutRate}
            setDropoutRate={setDropoutRate}
            demandMultiplier={demandMultiplier}
            setDemandMultiplier={setDemandMultiplier}
            targetArea={targetArea}
            setTargetArea={setTargetArea}
            areas={areas}
            onRun={() => void onRunSimulation()}
            isPending={simulationMutation.isPending}
            simulation={store.simulation}
          />
        </section>
      </main>
    </div>
  );
}
