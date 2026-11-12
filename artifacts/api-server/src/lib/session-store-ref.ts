// The app's session store, for code that runs outside a request (the report
// scheduler creates a short-lived session to read data as a user).
import type { Store } from "express-session";

let store: Store | null = null;

export function setSessionStore(s: Store): void {
  store = s;
}

export function getSessionStore(): Store | null {
  return store;
}
