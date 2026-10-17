"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

// A page left open across a deploy can call actions that never answer. After this long the
// callbacks run anyway (runAction gives null) so no "Guardando…" stays forever.
const TIMEOUT_MS = 20_000;

// router.refresh() returns before the new data is on screen. `refresh(then)` runs `then` once it is,
// and `refreshing` stays true meanwhile, so dialogs and buttons can wait instead of showing old data.
// `runAction` does the same for Server Actions that already revalidate the page.
export function useRefresh() {
  const router = useRouter();
  const [inTransition, startTransition] = React.useTransition();
  // Each call restarts the timer, including one made while an earlier transition is still stuck.
  const [calls, setCalls] = React.useState(0);
  const [gaveUp, setGaveUp] = React.useState(false);
  const refreshing = inTransition && !gaveUp;
  const pending = React.useRef<(() => void)[]>([]);

  React.useEffect(() => {
    if (!inTransition || calls === 0) return;
    setGaveUp(false);
    const timer = setTimeout(() => setGaveUp(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [inTransition, calls]);

  React.useEffect(() => {
    if (refreshing) return;
    const callbacks = pending.current;
    pending.current = [];
    callbacks.forEach((then) => {
      then();
    });
  }, [refreshing]);

  const refresh = React.useCallback(
    (then?: () => void) => {
      if (then) pending.current.push(then);
      setCalls((count) => count + 1);
      startTransition(() => router.refresh());
    },
    [router],
  );

  // For Server Actions that call revalidatePath: their response already brings the new page, so a
  // router.refresh() would render it twice. Inside the transition, `then` gets the result once that
  // page is on screen; an action that throws or doesn't answer in time gives null.
  const runAction = React.useCallback(function runAction<T>(
    action: () => Promise<T>,
    then: (result: T | null) => void,
  ) {
    let result: T | null = null;
    pending.current.push(() => then(result));
    setCalls((count) => count + 1);
    startTransition(async () => {
      try {
        result = await action();
      } catch {
        result = null;
      }
    });
  }, []);

  return { refresh, refreshing, runAction };
}
