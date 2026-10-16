// This marker suppresses presentation only. Completion always comes from the backend.
export function claimFiscalEntry(storage: Pick<Storage, "getItem" | "setItem">, sessionKey: string) {
  const key = `eli:desk-fiscal-entry:v1:${sessionKey}`;
  if (storage.getItem(key) === "shown") return false;
  storage.setItem(key, "shown");
  return true;
}
