/**
 * LeaveConfirm — quiet shell-register confirmation shown when the user tries
 * to navigate away mid-round in the Simulation. Platform chrome, so it speaks
 * teal glass (DESIGN.md) — deliberately NOT the game's amber register.
 *
 * The game's timer keeps running underneath: the clock never stops, and time
 * spent deciding is time lost — that's the game's own rule, so the dialog
 * must not pause anything.
 */
import { useEffect, useRef } from "react";
import "./leaveConfirm.css";

interface LeaveConfirmProps {
  onStay: () => void;
  onLeave: () => void;
}

export default function LeaveConfirm({ onStay, onLeave }: LeaveConfirmProps) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stayRef.current?.focus(); // non-destructive default gets focus
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onStay();
      } else if (e.key === "Tab") {
        // two-button focus loop — keep keyboard users inside the dialog
        const btns = panelRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!btns || btns.length === 0) return;
        const first = btns[0],
          last = btns[btns.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    // capture: beat the game's own key handlers while the dialog is up
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onStay]);

  return (
    <div className="leave-confirm" role="presentation" onClick={onStay}>
      <div
        ref={panelRef}
        className="leave-confirm__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="leave-confirm-title"
        aria-describedby="leave-confirm-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="leave-confirm-title" className="leave-confirm__title">
          Leave the simulation?
        </h2>
        <p id="leave-confirm-desc" className="leave-confirm__desc">
          Your round won&rsquo;t be recorded.
        </p>
        <div className="leave-confirm__row">
          <button ref={stayRef} type="button" className="leave-confirm__stay" onClick={onStay}>
            STAY
          </button>
          <button type="button" className="leave-confirm__leave" onClick={onLeave}>
            LEAVE
          </button>
        </div>
      </div>
    </div>
  );
}
