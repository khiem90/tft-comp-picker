interface AppHeaderProps {
  onNewGame: () => void;
}

// The top bar carries only chrome with a feature behind it: the brand and
// New Game. Patch, refresh state, and banners live elsewhere in the shell.
export function AppHeader({ onNewGame }: AppHeaderProps) {
  return (
    <header className="top-bar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1 22 6.5v11L12 23 2 17.5v-11z" />
        </svg>
        <h1>TFT Comp Picker</h1>
      </div>
      <button type="button" className="new-game-button" onClick={onNewGame}>
        New Game
      </button>
    </header>
  );
}
