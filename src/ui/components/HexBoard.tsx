import type { BoardSlot, RankedComp } from "../../shared/types";
import type { CompIcons } from "../compIcons";
import { isHeld } from "../comps";
import { IconTile } from "./IconTile";

const BOARD_ROWS = [0, 1, 2, 3];
const BOARD_COLS = [0, 1, 2, 3, 4, 5, 6];

// The Board layout: the 4x7 player half-board with the Comp's units on their
// hexes. Row 0 (front) renders at the top, and odd rows shift half a hex,
// matching the game's stagger. Held units keep full color on a cost-colored
// rim; missing ones dim so the board reads as what is left to buy. The line
// under the grid reads the layout provenance: a source-backed board is real
// placement data, a heuristic board (or one from a data file predating
// provenance) stays labeled as the local suggestion it is.
interface HexBoardProps {
  comp: RankedComp;
  icons: CompIcons;
  starTargets: ReadonlySet<string>;
}

export function HexBoard({ comp, icons, starTargets }: HexBoardProps) {
  const slotsByHex = new Map<string, BoardSlot>(
    comp.board.map((slot) => [`${slot.position!.row},${slot.position!.col}`, slot]),
  );
  const hexTitle = (slot: BoardSlot): string => {
    const parts = [slot.unit];
    parts.push(isHeld(comp, slot) ? "held" : `missing, ${slot.cost} gold`);
    if (starTargets.has(slot.apiName)) parts.push("3-star target");
    if (slot.items.length > 0) parts.push(slot.items.join(", "));
    return parts.join(" · ");
  };
  return (
    <div className="hex-board">
      {BOARD_ROWS.map((row) => (
        <div key={row} className={`hex-row ${row % 2 === 1 ? "hex-row-offset" : ""}`}>
          {BOARD_COLS.map((col) => {
            const slot = slotsByHex.get(`${row},${col}`);
            if (!slot) return <div key={col} className="hex-cell" />;
            const held = isHeld(comp, slot);
            return (
              <div
                key={col}
                className={`hex-cell occupied ${held ? "hex-held" : "hex-missing"} cost-${slot.cost}`}
                title={hexTitle(slot)}
              >
                <span className="hex-frame">
                  <span className="hex-portrait">
                    <IconTile src={icons.units.get(slot.apiName)} label={slot.unit} />
                  </span>
                </span>
                {starTargets.has(slot.apiName) && <span className="hex-star">★★★</span>}
                {slot.items.length > 0 && (
                  <span className="hex-items">
                    {slot.items.map((item, index) => (
                      <span
                        key={`${slot.itemApiNames[index]}-${index}`}
                        className="hex-item"
                        title={item}
                      >
                        <IconTile src={icons.items.get(slot.itemApiNames[index])} label={item} />
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <p className={`board-provenance ${comp.layoutProvenance === "source" ? "is-source" : ""}`}>
        {comp.layoutProvenance === "source"
          ? "Most-played positions from the meta source."
          : "Suggested positions from unit roles and range, not from the meta source."}
      </p>
    </div>
  );
}
