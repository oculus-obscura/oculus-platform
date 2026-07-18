import { useState } from "react";
import IntroSequence from "./parts/Intro/IntroSequence";
import "./App.css";

export default function App() {
  const [entered, setEntered] = useState(false);

  if (!entered) {
    return <IntroSequence onEnter={() => setEntered(true)} />;
  }

  // Temporary stub for the next part — replaced once the dashboard/game land.
  return (
    <main className="post-intro">
      <p className="post-intro__note">Part 2 — coming soon</p>
    </main>
  );
}
