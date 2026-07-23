/**
 * SynthesisPlaceholder — the Synthesis section isn't built yet. A quiet
 * Space-Black holding screen, consistent with how other unbuilt sections are
 * signalled (muted, no promises). Reached from the Simulation's end screen.
 */
import "./synthesisPlaceholder.css";

export default function SynthesisPlaceholder() {
  return (
    <div className="synth-placeholder">
      <p className="synth-placeholder__text">Synthesis — coming soon</p>
    </div>
  );
}
