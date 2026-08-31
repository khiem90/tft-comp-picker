import type { CompFit, RankedComp } from "../../shared/types";

function priorityState(item: string, fit: Pick<CompFit, "heldItems" | "partialItems">) {
  if (fit.heldItems.includes(item)) return "held";
  if (fit.partialItems.includes(item)) return "partial";
  return "missing";
}

interface CompCardProps {
  comp: RankedComp;
}

export function CompCard({ comp }: CompCardProps) {
  return (
    <li className="comp">
      <div className="comp-header">
        <span className={`tier tier-${comp.tier.toLowerCase()}`}>{comp.tier}</span>
        <h2>{comp.name}</h2>
        <span className="fit-score">Fit {comp.fit.score}</span>
      </div>
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
