import type { RankedComp } from "../../shared/types";
import { CompCard, type CompIcons } from "./CompCard";

interface CompListProps {
  comps: RankedComp[];
  icons: CompIcons;
}

export function CompList({ comps, icons }: CompListProps) {
  return (
    <ol className="comp-list">
      {comps.map((comp, index) => (
        <CompCard key={comp.id} comp={comp} rank={index + 1} icons={icons} />
      ))}
    </ol>
  );
}
