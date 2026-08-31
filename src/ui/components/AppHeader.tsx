import type { ReactNode } from "react";

interface AppHeaderProps {
  patch: string;
  refreshedAt: string;
  refreshing: boolean;
  onRefresh: () => void;
  onNewGame: () => void;
  // Status banners; rendered inside the header so failures sit next to the
  // freshness line they contradict.
  children?: ReactNode;
}

export function AppHeader({
  patch,
  refreshedAt,
  refreshing,
  onRefresh,
  onNewGame,
  children,
}: AppHeaderProps) {
  return (
    <header>
      <div className="header-row">
        <h1>TFT Comp Picker</h1>
        <div className="header-actions">
          <button
            type="button"
            className="header-button"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button type="button" className="header-button" onClick={onNewGame}>
            New game
          </button>
        </div>
      </div>
      <p className="meta">
        Patch {patch} · refreshed {new Date(refreshedAt).toLocaleString()}
      </p>
      {children}
    </header>
  );
}
