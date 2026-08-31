import type { CompFit, RankedComp } from "../../shared/types";
import { IconTile } from "./IconTile";

function priorityState(item: string, fit: Pick<CompFit, "heldItems" | "partialItems">) {
  if (fit.heldItems.includes(item)) return "held";
  if (fit.partialItems.includes(item)) return "partial";
  return "missing";
}

// Icon URLs keyed by apiName, one map per Set data catalog. Built once in
// App and threaded to every card.
export interface CompIcons {
  traits: ReadonlyMap<string, string | undefined>;
  units: ReadonlyMap<string, string | undefined>;
  items: ReadonlyMap<string, string | undefined>;
}

interface CompCardProps {
  comp: RankedComp;
  // Position in the ranked list, 1-based.
  rank: number;
  icons: CompIcons;
}

export function CompCard({ comp, rank, icons }: CompCardProps) {
  const traits = comp.traits ?? [];
  // Core Units resolve through their board slots: the slot carries the
  // display name, cost, and build items the strip renders. A core apiName
  // with no slot cannot happen in server output but costs nothing to skip.
  const coreSlots = (comp.coreUnits ?? []).flatMap((api) => {
    const slot = comp.board.find((candidate) => candidate.apiName === api);
    return slot ? [slot] : [];
  });
  const starTargets = new Set(comp.starTargets ?? []);
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
                <IconTile src={icons.traits.get(trait.apiName)} label={trait.name} />
              </span>
              {trait.count} {trait.name}
            </li>
          ))}
          {comp.playstyle && <li className="playstyle-chip">{comp.playstyle}</li>}
        </ul>
      )}
      {coreSlots.length > 0 && (
        <ul className="core-units">
          {coreSlots.map((slot) => (
            <li key={slot.apiName} className="core-unit">
              <span className={`core-portrait portrait cost-frame-${slot.cost}`}>
                <IconTile src={icons.units.get(slot.apiName)} label={slot.unit} />
                {starTargets.has(slot.apiName) && (
                  <span className="star-marker" title={`3-star target: ${slot.unit}`}>
                    ★★★
                  </span>
                )}
              </span>
              <span className="core-name">{slot.unit}</span>
              {slot.items.length > 0 && (
                <span className="core-items">
                  {slot.items.map((item, index) => (
                    <span
                      key={`${slot.itemApiNames[index]}-${index}`}
                      className="core-item"
                      title={item}
                    >
                      <IconTile src={icons.items.get(slot.itemApiNames[index])} label={item} />
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
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
            <span className="unit">
              {/* A Star target is not always a Core Unit, so the marker must
                  also live here or some targets would never show. */}
              {starTargets.has(slot.apiName) && (
                <span className="slot-star" title={`3-star target: ${slot.unit}`}>
                  ★★★{" "}
                </span>
              )}
              {slot.unit}
            </span>
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
