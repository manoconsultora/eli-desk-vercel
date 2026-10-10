"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

// router.refresh() returns before the new data is on screen. `refresh(then)` runs `then` once it is,
// and `refreshing` stays true meanwhile, so dialogs and buttons can wait instead of showing old data.
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

  return { refresh, refreshing };
}
