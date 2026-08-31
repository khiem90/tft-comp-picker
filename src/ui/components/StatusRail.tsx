interface StatusRailProps {
  patch: string;
  refreshedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
}

// Right rail: the trust panel. Patch and refreshed-at say how current the
// recommendations are; the Refresh button is the manual override that was in
// the old header, moved here so freshness and the fix for it sit together.
export function StatusRail({
  patch,
  refreshedAt,
  refreshing,
  onRefresh,
}: StatusRailProps) {
  return (
    <div className="status-panel">
      <h2 className="status-patch">Patch {patch}</h2>
      <p className="status-refreshed">
        Refreshed {new Date(refreshedAt).toLocaleString()}
      </p>
      <button
        type="button"
        className="panel-button"
        onClick={onRefresh}
        disabled={refreshing}
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
