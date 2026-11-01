import { sqliteD1 } from "../sqliteD1.ts";

/** An in-memory D1 with every migration applied. */
export function fakeD1() {
  return sqliteD1();
}
