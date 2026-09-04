import type { RankedComp, Tier } from "../../shared/types";
import type { CompIcons } from "../compIcons";
import { isHeld, mosaicSlots, TIER_ORDER, TIER_WORD } from "../comps";
import { IconTile } from "./IconTile";

// rank is the Comp's 1-based position in the full ranking, computed before
// any filtering so a filtered lane shows true ranks, not a renumbering that
// would pass a mid-table Comp off as the overall best.
export interface RankedEntry {
  comp: RankedComp;
  rank: number;
}

interface TierLanesProps {
  entries: RankedEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
  icons: CompIcons;
  // With no Holdings every Comp holds zero units; dimming all of them would
  // say nothing, so tiles only dim once there is something to hold.
  holdingsEmpty: boolean;
  // Why the overall best sits below a stronger lane, or null when it does
  // not. Rendered under the lane that holds it.
  laneNote: string | null;
}

// The meta source is a tier list, so the page is one: every Comp in its
// Tier's lane, sorted within the lane by the server's ranking (Tier is
// constant inside a lane, so that order is fit order). The overall best
// carries a flag wherever it lands.
export function TierLanes({
  entries,
  selectedId,
  onSelect,
  icons,
  holdingsEmpty,
  laneNote,
}: TierLanesProps) {
  const lanes = TIER_ORDER.map((tier) => ({
    tier,
    entries: entries.filter((entry) => entry.comp.tier === tier),
  })).filter((lane) => lane.entries.length > 0);
  const best = entries.find((entry) => entry.rank === 1);
  return (
    <div className="lanes">
      {lanes.map((lane) => (
        <section key={lane.tier} className={`lane tier-${lane.tier.toLowerCase()}`}>
          <h2 className="lane-letter">
            {lane.tier}
            <small>
              {lane.entries.length} {lane.entries.length === 1 ? "comp" : "comps"} · {TIER_WORD[lane.tier as Tier]}
            </small>
          </h2>
          <ul className="tiles">
            {lane.entries.map(({ comp, rank }) => (
              <li key={comp.id}>
                <button
                  type="button"
                  className={`tile ${
                    !holdingsEmpty && comp.fit.heldUnits.length === 0 ? "is-dim" : ""
                  }`}
                  aria-pressed={comp.id === selectedId}
                  onClick={() => onSelect(comp.id)}
                >
                  {rank === 1 && <span className="tile-flag">Play this · #1 overall</span>}
                  <span className="mosaic">
                    {mosaicSlots(comp).map((slot) => (
                      <span
                        key={slot.apiName}
                        className={`mosaic-cell cost-${slot.cost} ${
                          isHeld(comp, slot) ? "is-held" : "is-missing"
                        }`}
                      >
                        <IconTile src={icons.units.get(slot.apiName)} label={slot.unit} />
                      </span>
                    ))}
                  </span>
                  <span className="tile-name">{comp.name}</span>
                  <span className="tile-stat">
                    <span>
                      <b>{comp.fit.heldUnits.length}</b>/{comp.board.length} held
                    </span>
                    <span>#{rank}</span>
                  </span>
                  <span className="tile-bar">
                    <i style={{ width: `${comp.fit.score}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {laneNote && best && best.comp.tier === lane.tier && (
            <p className="lane-note">{laneNote}</p>
          )}
        </section>
      ))}
    </div>
  );
}
