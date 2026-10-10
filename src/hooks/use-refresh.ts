"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

// router.refresh() returns before the new data is on screen. `refresh(then)` runs `then` once it is,
// and `refreshing` stays true meanwhile, so dialogs and buttons can wait instead of showing old data.
// `runAction` does the same for Server Actions that already revalidate the page.
export function useRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = React.useTransition();
  const pending = React.useRef<(() => void)[]>([]);

  React.useEffect(() => {
    if (refreshing) return;
    const callbacks = pending.current;
    pending.current = [];
    for (const then of callbacks) then();
  }, [refreshing]);

  const refresh = React.useCallback(
    (then?: () => void) => {
      if (then) pending.current.push(then);
      startTransition(() => router.refresh());
    },
    [router],
  );

  // For Server Actions that call revalidatePath: their response already brings the new page, so a
  // router.refresh() would render it twice. Inside the transition, `then` gets the result once that
  // page is on screen; an action that throws (no answer, e.g. after a deploy) gives null.
  const runAction = React.useCallback(function runAction<T>(
    action: () => Promise<T>,
    then: (result: T | null) => void,
  ) {
    startTransition(async () => {
      let result: T | null = null;
      try {
        result = await action();
      } catch {
        result = null;
      }
      pending.current.push(() => then(result));
    });
  }, []);

  return { refresh, refreshing, runAction };
}
