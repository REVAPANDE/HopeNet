export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      <div className="skeleton hero-skeleton" />
      <div className="skeleton-grid">
        <div className="skeleton metric-skeleton" />
        <div className="skeleton metric-skeleton" />
        <div className="skeleton metric-skeleton" />
        <div className="skeleton metric-skeleton" />
      </div>
      <div className="skeleton-grid wide">
        <div className="skeleton panel-skeleton" />
        <div className="skeleton panel-skeleton" />
      </div>
    </div>
  );
}

