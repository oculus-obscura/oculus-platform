/**
 * Placeholder shell. No features yet — this only proves the design tokens and
 * fonts load. Real screens (dashboard, game) come later. Keep this shell quiet
 * and teal-monochrome per DESIGN.md; no data-encoding colors outside charts.
 */
import "./App.css";

export default function App() {
  return (
    <main className="app-scaffold">
      <p className="app-scaffold__eyebrow">Scaffold</p>
      <h1 className="display">Oculus Obscura</h1>
      <p className="app-scaffold__note prose">
        Vite + React + TypeScript is running. Design tokens, fonts, and CSS
        structure are wired up — no screens built yet.
      </p>
    </main>
  );
}
