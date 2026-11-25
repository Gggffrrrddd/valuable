import { useEffect, useRef } from "react";
export const TIMER_HISTORY_STATE = "timer-session";

export function pushTimerHistory() {
  try {
    if (window.history.state?.app !== TIMER_HISTORY_STATE) {
      window.history.pushState({ app: TIMER_HISTORY_STATE }, "");
    }
  } catch {
    /* history unavailable */
  }
}

export function releaseTimerHistory() {
  try {
    if (window.history.state?.app === TIMER_HISTORY_STATE) {
      window.history.replaceState({ app: "home" }, "");
    }
  } catch {
    /* history unavailable */
  }
}

/**
 * Guards an active focus session against the system back button.
 * Reusable by a Capacitor `backButton` listener with the same callback.
 */
export function useSessionBackGuard(
  active: boolean,
  popupOpen: boolean,
  onBack: (popupOpen: boolean) => void,
) {
  const popupRef = useRef(popupOpen);
  const onBackRef = useRef(onBack);
  popupRef.current = popupOpen;
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    pushTimerHistory();
    const onPopState = () => {
      pushTimerHistory();
      onBackRef.current(popupRef.current);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      releaseTimerHistory();
    };
  }, [active]);
}
