import type { RankedComp } from "../../shared/types";
import { CompCard } from "./CompCard";

interface CompListProps {
  comps: RankedComp[];
}

export function CompList({ comps }: CompListProps) {
  return (
    <ol className="comp-list">
      {comps.map((comp) => (
        <CompCard key={comp.id} comp={comp} />
      ))}
    </ol>
  );
}
