import type { RankedComp } from "../../shared/types";
import { CompCard } from "./CompCard";

interface CompListProps {
  comps: RankedComp[];
  // Trait icon URLs keyed by trait apiName, from Set data.
  traitIcons: ReadonlyMap<string, string | undefined>;
}

export function CompList({ comps, traitIcons }: CompListProps) {
  return (
    <ol className="comp-list">
      {comps.map((comp, index) => (
        <CompCard key={comp.id} comp={comp} rank={index + 1} traitIcons={traitIcons} />
      ))}
    </ol>
  );
}
