import { useEffect, useState } from "react";

interface BoardSlot {
  unit: string;
  cost: number;
  items: string[];
}

interface Comp {
  id: string;
  name: string;
  tier: string;
  board: BoardSlot[];
  itemPriorities: string[];
}

interface CompsResponse {
  patch: string;
  refreshedAt: string;
  comps: Comp[];
}

export function App() {
  const [data, setData] = useState<CompsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/comps")
      .then((response) => {
        if (!response.ok) throw new Error(`Server answered ${response.status}`);
        return response.json();
      })
      .then(setData)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) return <p className="status">Could not load Comps: {error}</p>;
  if (!data) return <p className="status">Loading Comps…</p>;

  return (
    <main>
      <header>
        <h1>TFT Comp Picker</h1>
        <p className="meta">
          Patch {data.patch} · refreshed {new Date(data.refreshedAt).toLocaleString()}
        </p>
      </header>
      <ol className="comp-list">
        {data.comps.map((comp) => (
          <li key={comp.id} className="comp">
            <div className="comp-header">
              <span className={`tier tier-${comp.tier.toLowerCase()}`}>{comp.tier}</span>
              <h2>{comp.name}</h2>
            </div>
            <ul className="board">
              {comp.board.map((slot) => (
                <li key={slot.unit} className={`slot cost-${slot.cost}`}>
                  <span className="unit">{slot.unit}</span>
                  {slot.items.length > 0 && (
                    <span className="items">{slot.items.join(", ")}</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="priorities">
              Items: {comp.itemPriorities.join(" → ")}
            </p>
          </li>
        ))}
      </ol>
    </main>
  );
}
