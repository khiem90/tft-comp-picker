import type { PatchChange } from "../../shared/types";

interface StatusBannersProps {
  fetchError: string | null;
  refreshError: string | null;
  patchChange: PatchChange | null;
}

export function StatusBanners({
  fetchError,
  refreshError,
  patchChange,
}: StatusBannersProps) {
  return (
    <>
      {fetchError && (
        <p className="refresh-error">
          Could not reach the server ({fetchError}), showing last good data.
        </p>
      )}
      {refreshError && (
        <p className="refresh-error">
          Refresh failed ({refreshError}), showing last good data.
        </p>
      )}
      {patchChange && (
        <div className="patch-change">
          <p>
            Patch {patchChange.toPatch} is live (was {patchChange.fromPatch}).
            Set data and Comps re-pulled.
          </p>
          <ul>
            {patchChange.addedComps.length > 0 && (
              <li>New: {patchChange.addedComps.join(", ")}</li>
            )}
            {patchChange.removedComps.length > 0 && (
              <li>Gone: {patchChange.removedComps.join(", ")}</li>
            )}
            {patchChange.tierMoves.length > 0 && (
              <li>
                Tier moves:{" "}
                {patchChange.tierMoves
                  .map((move) => `${move.name} ${move.from} → ${move.to}`)
                  .join(", ")}
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}
