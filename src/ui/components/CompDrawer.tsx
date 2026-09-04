import type { CompFit, RankedComp } from "../../shared/types";
import type { CompIcons } from "../compIcons";
import { goldToBuy, isHeld, missingSlots } from "../comps";
import { HexBoard } from "./HexBoard";
import { IconTile } from "./IconTile";

function itemState(item: string, fit: Pick<CompFit, "heldItems" | "partialItems">) {
  if (fit.heldItems.includes(item)) return "held";
  if (fit.partialItems.includes(item)) return "partial";
  return "missing";
}

interface CompDrawerProps {
  comp: RankedComp;
  // Position in the full ranking, 1-based.
  rank: number;
  icons: CompIcons;
}

// The right-hand detail for the selected Comp: how close it is in three
// numbers, the board, and what to buy or build next.
export function CompDrawer({ comp, rank, icons }: CompDrawerProps) {
  const starTargets = new Set(comp.starTargets ?? []);
  const missing = missingSlots(comp);
  const traits = comp.traits ?? [];
  const augments = comp.augments ?? [];
  return (
    <aside className="drawer" aria-live="polite">
      <div className="drawer-kicker">
        <span className={`lane-mark tier-${comp.tier.toLowerCase()}`}>{comp.tier}</span>
        <span className="drawer-sub">
          #{rank} overall{comp.playstyle ? ` · ${comp.playstyle}` : ""}
        </span>
      </div>
      <h2 className="drawer-title">{comp.name}</h2>

      <dl className="stats">
        <div>
          <dd>{comp.fit.score}%</dd>
          <dt>fit</dt>
        </div>
        <div>
          <dd>
            {comp.fit.heldUnits.length}/{comp.board.length}
          </dd>
          <dt>units held</dt>
        </div>
        <div>
          <dd className="is-gold">{goldToBuy(comp)}</dd>
          <dt>gold to buy the rest</dt>
        </div>
      </dl>

      <section>
        <h3 className="eyebrow">Board</h3>
        {comp.board.every((slot) => slot.position) ? (
          <HexBoard comp={comp} icons={icons} starTargets={starTargets} />
        ) : (
          /* Data files written before layout derivation carry no positions;
             they keep the flat slot list rather than a board of guesses. */
          <ul className="board-list">
            {comp.board.map((slot) => (
              <li
                key={slot.unit}
                className={`board-slot cost-${slot.cost} ${isHeld(comp, slot) ? "is-held" : "is-missing"}`}
              >
                <span className="board-slot-unit">
                  {starTargets.has(slot.apiName) && (
                    <span className="star-text" title={`3-star target: ${slot.unit}`}>
                      ★★★{" "}
                    </span>
                  )}
                  {slot.unit}
                </span>
                {slot.items.length > 0 && (
                  <span className="board-slot-items">{slot.items.join(", ")}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {traits.length > 0 && (
        <section>
          <h3 className="eyebrow">Traits</h3>
          <ul className="trait-list">
            {traits.map((trait) => (
              <li key={trait.apiName}>
                <b>{trait.count}</b> {trait.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="eyebrow">Buy next, cheapest first</h3>
        {missing.length === 0 ? (
          <p className="drawer-sub">You hold every unit on this board.</p>
        ) : (
          <ul className="buy-list">
            {missing.map((slot) => (
              <li key={slot.apiName} className={`cost-${slot.cost}`}>
                <span className="buy-portrait portrait">
                  <IconTile src={icons.units.get(slot.apiName)} label={slot.unit} />
                </span>
                <span className="buy-name">
                  {slot.unit}
                  {starTargets.has(slot.apiName) && (
                    <span className="star-text" title="Players 3-star this unit">
                      {" "}★
                    </span>
                  )}
                </span>
                <span className="buy-gold">{slot.cost} g</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="eyebrow">Items · green built, gold half</h3>
        <ul className="item-row">
          {comp.itemPriorities.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className={`item-tile is-${itemState(item, comp.fit)}`}
              title={item}
            >
              <IconTile src={icons.items.get(comp.itemPriorityApiNames[index])} label={item} />
            </li>
          ))}
        </ul>
      </section>

      {augments.length > 0 && (
        <section>
          <h3 className="eyebrow">Augments</h3>
          <ul className="trait-list">
            {augments.map((augment) => (
              <li
                key={augment}
                className={comp.fit.matchedAugments.includes(augment) ? "is-held" : "is-missing"}
              >
                {augment}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="drawer-sub">{comp.fit.reason}.</p>
    </aside>
  );
}
