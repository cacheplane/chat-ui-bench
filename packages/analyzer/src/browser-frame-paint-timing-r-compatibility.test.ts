import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  PAINT_TIMING_R_BODY_POLICY,
  PAINT_TIMING_R_SOURCE_ABI_V1,
} from "./browser-frame-paint-timing-r-fragments.js";
it("keeps private imports, public exports and historical readers separate", () => {
  const source = readFileSync(
    new URL("./browser-frame-paint-timing-r-fragments.ts", import.meta.url),
    "utf8",
  );
  const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(
    (x) => x[1],
  );
  expect(imports.sort()).toEqual([
    "./browser-frame-protobuf-wire.js",
    "node:crypto",
  ]);
  for (const name of [
    "index.ts",
    "browser-frame-packet-fragments.ts",
    "browser-frame-whole-trace-reader.ts",
  ])
    expect(readFileSync(new URL(name, import.meta.url), "utf8")).not.toContain(
      "paint-timing-r-fragments",
    );
  expect(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ).not.toContain("paint-timing-r");
  expect(PAINT_TIMING_R_BODY_POLICY).toBe(
    "pinned-paint-timing-r-source-body-fragments-v1",
  );
  expect(PAINT_TIMING_R_SOURCE_ABI_V1.chromiumRevision).toBe(
    "f842f52ef39fd97b449eb27cff414bf05a98ddce",
  );
  expect(PAINT_TIMING_R_SOURCE_ABI_V1.perfettoRevision).toBe(
    "403906f4adfbf287a02e5546f8430dcc9d56b649",
  );
});
