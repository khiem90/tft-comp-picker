import type { RankedComp } from "../../shared/types";
import { CompCard, type CompIcons } from "./CompCard";

// rank is the Comp's 1-based position in the full ranking, computed before
// any filtering so a filtered list shows true ranks, not a renumbering that
// would pass a mid-table Comp off as the overall best.
export interface RankedEntry {
  comp: RankedComp;
  rank: number;
}

interface CompListProps {
  entries: RankedEntry[];
  icons: CompIcons;
}

export function CompList({ entries, icons }: CompListProps) {
  return (
    <ol className="comp-list">
      {entries.map(({ comp, rank }) => (
        <CompCard key={comp.id} comp={comp} rank={rank} icons={icons} />
      ))}
    </ol>
  );
}
