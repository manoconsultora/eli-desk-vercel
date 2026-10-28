import type { ConsorcioScope } from "./feature-scope-types";

// A feature's scope can be narrower than the membership's consorcios, which is all RLS looks at:
// pages and actions check it before reading or writing.
export function isConsorcioInScope(scope: ConsorcioScope, consorcioId: string): boolean {
  return scope.kind === "all_consorcios" || scope.consorcioIds.includes(consorcioId);
}
