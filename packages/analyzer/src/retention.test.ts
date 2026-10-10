import { expect, it } from "vitest";
import { retainedBuffers, retentionDelta } from "./retention.js";
// Deliberately nonstandard field order proves parsing follows meta rather than offsets.
function snapshot(count: number, weak = false) {
  const strings = [
    "root",
    "ReferenceRetainedBufferOwner",
    "Array",
    "Uint8Array",
    "ArrayBuffer",
    "system / JSArrayBufferData",
    "referenceRetainedBufferOwner",
    "retainedBuffers",
    "buffer",
    "backing_store",
  ];
  const nodes: number[] = [];
  const edges: number[] = [];
  const add = (
    type: number,
    name: number,
    bytes: number,
    links: [number, number, number][],
  ) => {
    nodes.push(name, bytes, type, links.length, nodes.length + 1);
    links.forEach((l) => edges.push(l[1], l[2] * 5, l[0]));
  };
  add(0, 0, 0, [[weak ? 3 : 1, 6, 1]]);
  add(1, 1, 8, [[1, 7, 2]]);
  add(
    1,
    2,
    8,
    Array.from({ length: count }, (_, i) => [0, i, 3 + i * 3]),
  );
  for (let i = 0; i < count; i++) {
    add(1, 3, 8, [[1, 8, 4 + i * 3]]);
    add(1, 4, 8, [[2, 9, 5 + i * 3]]);
    add(2, 5, 4194304, []);
  }
  return {
    snapshot: {
      meta: {
        node_fields: ["name", "self_size", "type", "edge_count", "id"],
        node_types: [[], [], ["synthetic", "object", "native"], [], []],
        edge_fields: ["name_or_index", "to_node", "type"],
        edge_types: [[], [], ["element", "property", "internal", "weak"]],
      },
    },
    strings,
    nodes,
    edges,
  };
}
it("counts named strong ownership paths and backing storage, not global V8 totals", () => {
  const m = retentionDelta(snapshot(0), snapshot(5));
  expect(m.status).toBe("available");
  expect(m.value.retainedCountDelta).toBe(5);
  expect(m.value.nativeBytesDelta).toBe(20971520);
  expect(m.value.post.paths).toHaveLength(5);
});
it("release control is supported zero with a present empty ownership holder", () =>
  expect(retentionDelta(snapshot(0), snapshot(0)).value.nativeBytesDelta).toBe(
    0,
  ));
it("weak ownership and unknown schemas are unavailable instead of zero", () => {
  expect(retainedBuffers(snapshot(5, true)).status).toBe("unavailable");
  expect(retainedBuffers({ nodes: [] }).status).toBe("unavailable");
});
