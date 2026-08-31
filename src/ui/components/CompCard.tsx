import type { CompFit, RankedComp } from "../../shared/types";
import { IconTile } from "./IconTile";

function priorityState(item: string, fit: Pick<CompFit, "heldItems" | "partialItems">) {
  if (fit.heldItems.includes(item)) return "held";
  if (fit.partialItems.includes(item)) return "partial";
  return "missing";
}

interface CompCardProps {
  comp: RankedComp;
  // Position in the ranked list, 1-based.
  rank: number;
  traitIcons: ReadonlyMap<string, string | undefined>;
}

export function CompCard({ comp, rank, traitIcons }: CompCardProps) {
  const traits = comp.traits ?? [];
  return (
    <li className="comp">
      <div className="comp-header">
        <span className="rank-badge">{rank}</span>
        <h2>{comp.name}</h2>
        <span className={`tier tier-${comp.tier.toLowerCase()}`}>{comp.tier}</span>
        <span className="fit-score">Fit {comp.fit.score}%</span>
      </div>
      {(traits.length > 0 || comp.playstyle) && (
        <ul className="trait-chips">
          {traits.map((trait) => (
            <li key={trait.apiName} className="trait-chip">
              <span className="trait-icon">
                <IconTile src={traitIcons.get(trait.apiName)} label={trait.name} />
              </span>
              {trait.count} {trait.name}
            </li>
          ))}
          {comp.playstyle && <li className="playstyle-chip">{comp.playstyle}</li>}
        </ul>
      )}
      <ul className="board">
        {comp.board.map((slot) => (
          <li
            key={slot.unit}
            className={`slot cost-${slot.cost} ${
              comp.fit.heldUnits.includes(slot.unit) ? "held" : "missing"
            }`}
          >
            <span className="unit">{slot.unit}</span>
            {slot.items.length > 0 && (
              <span className="items">{slot.items.join(", ")}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="fit-reason">{comp.fit.reason}</p>
      <p className="priorities">
        Items:{" "}
        {comp.itemPriorities.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className={`priority ${priorityState(item, comp.fit)}`}
          >
            {item}
          </span>
        ))}
      </p>
      {(comp.augments ?? []).length > 0 && (
        <p className="priorities">
          Augments:{" "}
          {comp.augments!.map((augment) => (
            <span
              key={augment}
              className={`priority ${
                comp.fit.matchedAugments.includes(augment) ? "held" : "missing"
              }`}
            >
              {augment}
            </span>
          ))}
        </p>
      )}
    </li>
  );
}
