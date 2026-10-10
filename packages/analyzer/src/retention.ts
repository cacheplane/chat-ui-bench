import type { Availability } from "@chat-ui-bench/contract";
interface HeapSnapshot {
  snapshot: {
    meta: {
      node_fields: string[];
      node_types: unknown[];
      edge_fields: string[];
      edge_types: unknown[];
    };
  };
  nodes: number[];
  edges: number[];
  strings: string[];
}
export interface BufferOwnership {
  count: number;
  nativeBytes: number;
  paths: string[];
  limits: string;
}
export function retainedBuffers(input: unknown): Availability<BufferOwnership> {
  try {
    const s = input as HeapSnapshot;
    const m = s.snapshot.meta;
    const nf = m.node_fields;
    const ef = m.edge_fields;
    if (
      !Array.isArray(nf) ||
      !Array.isArray(ef) ||
      !Array.isArray(s.nodes) ||
      !Array.isArray(s.edges) ||
      !Array.isArray(s.strings)
    )
      throw new Error("Unknown V8 snapshot schema");
    const index = (fields: string[], name: string) => {
      const i = fields.indexOf(name);
      if (i < 0) throw new Error(`Missing metadata field ${name}`);
      return i;
    };
    const ni = {
      type: index(nf, "type"),
      name: index(nf, "name"),
      id: index(nf, "id"),
      size: index(nf, "self_size"),
      edges: index(nf, "edge_count"),
    };
    const ei = {
      type: index(ef, "type"),
      name: index(ef, "name_or_index"),
      to: index(ef, "to_node"),
    };
    const nt = m.node_types[ni.type];
    const et = m.edge_types[ei.type];
    if (
      !Array.isArray(nt) ||
      !Array.isArray(et) ||
      !et.includes("weak") ||
      !et.includes("element")
    )
      throw new Error("Unsupported node/edge type dictionary");
    if (s.nodes.length % nf.length || s.edges.length % ef.length)
      throw new Error("Truncated flattened V8 snapshot");
    interface Link {
      type: string;
      name: string;
      to: number;
    }
    const links = new Map<number, Link[]>();
    let edgeOffset = 0;
    const nodeName = (i: number) => s.strings[s.nodes[i + ni.name]!]!;
    const nodeType = (i: number) => nt[s.nodes[i + ni.type]!] as string;
    for (let i = 0; i < s.nodes.length; i += nf.length) {
      const count = s.nodes[i + ni.edges]!;
      if (!Number.isInteger(count) || count < 0)
        throw new Error("Invalid edge count");
      const list: Link[] = [];
      for (let j = 0; j < count; j++) {
        const o = edgeOffset + j * ef.length;
        const type = et[s.edges[o + ei.type]!] as string;
        const to = s.edges[o + ei.to]!;
        if (
          !type ||
          !Number.isInteger(to) ||
          to < 0 ||
          to >= s.nodes.length ||
          to % nf.length
        )
          throw new Error("Invalid snapshot edge");
        const name =
          type === "element"
            ? String(s.edges[o + ei.name])
            : s.strings[s.edges[o + ei.name]!]!;
        list.push({ type, name, to });
      }
      links.set(i, list);
      edgeOffset += count * ef.length;
    }
    if (edgeOffset !== s.edges.length)
      throw new Error("Edge counts do not cover snapshot");
    // Root reachability is strong-edge graph reachability, not a dominator/retained-size claim.
    const reachable = new Set<number>([0]);
    const queue = [0];
    for (let q = 0; q < queue.length; q++)
      for (const link of links.get(queue[q]!)!) {
        if (link.type !== "weak" && !reachable.has(link.to)) {
          reachable.add(link.to);
          queue.push(link.to);
        }
      }
    const ownerLinks = [...reachable].flatMap((i) =>
      links
        .get(i)!
        .filter(
          (e) =>
            e.type !== "weak" &&
            e.name === "referenceRetainedBufferOwner" &&
            nodeType(e.to) === "object" &&
            nodeName(e.to) === "ReferenceRetainedBufferOwner",
        ),
    );
    if (!ownerLinks.length)
      throw new Error(
        "Named module holder referenceRetainedBufferOwner has no strongly reachable ReferenceRetainedBufferOwner path",
      );
    const stores = new Map<number, string>();
    const buffers = new Set<number>();
    for (const owner of ownerLinks) {
      const arrays = links
        .get(owner.to)!
        .filter(
          (e) =>
            e.type === "property" &&
            e.name === "retainedBuffers" &&
            nodeName(e.to) === "Array",
        );
      if (!arrays.length)
        throw new Error("Missing retainedBuffers property path");
      for (const array of arrays)
        for (const typed of links
          .get(array.to)!
          .filter((e) => e.type === "element")) {
          if (
            nodeType(typed.to) !== "object" ||
            nodeName(typed.to) !== "Uint8Array"
          )
            throw new Error("Unknown retainedBuffers element type");
          const backing = links
            .get(typed.to)!
            .find(
              (e) =>
                e.type !== "weak" &&
                e.name === "buffer" &&
                nodeName(e.to) === "ArrayBuffer",
            );
          if (!backing) throw new Error("Missing Uint8Array buffer path");
          const native = links
            .get(backing.to)!
            .find(
              (e) =>
                e.type === "internal" &&
                e.name === "backing_store" &&
                nodeType(e.to) === "native" &&
                nodeName(e.to) === "system / JSArrayBufferData",
            );
          if (!native)
            throw new Error("Missing ArrayBuffer native backing_store path");
          buffers.add(backing.to);
          stores.set(
            native.to,
            `referenceRetainedBufferOwner -> ReferenceRetainedBufferOwner#${s.nodes[owner.to + ni.id]} -> retainedBuffers -> Array[${typed.name}] -> Uint8Array#${s.nodes[typed.to + ni.id]} -> buffer -> ArrayBuffer#${s.nodes[backing.to + ni.id]} -> internal backing_store -> system / JSArrayBufferData#${s.nodes[native.to + ni.id]}`,
          );
        }
    }
    let nativeBytes = 0;
    for (const offset of stores.keys()) {
      const bytes = s.nodes[offset + ni.size]!;
      if (!Number.isFinite(bytes) || bytes < 0)
        throw new Error("Invalid native self_size");
      nativeBytes += bytes;
    }
    return {
      status: "available",
      value: {
        count: buffers.size,
        nativeBytes,
        paths: [...stores.values()],
        limits:
          "Distinct strongly reachable named ownership paths; sums native backing-store self_size once per store. No dominator retained-size or total-browser-memory claim; metadata/names specific to supported V8 snapshots.",
      },
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: `Retention unvalidated: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
export function retentionDelta(
  baseline: unknown,
  post: unknown,
  metadata?: unknown,
): Availability<{
  retainedCountDelta: number;
  nativeBytesDelta: number;
  baseline: BufferOwnership;
  post: BufferOwnership;
}> {
  const capability = metadata as
    | { status?: string; reason?: string }
    | undefined;
  if (capability?.status === "unavailable")
    return {
      status: "unavailable",
      reason: `Retention unvalidated: ${capability.reason ?? "Snapshot capability unavailable without a recorded reason"}`,
    };
  const a = retainedBuffers(baseline);
  const b = retainedBuffers(post);
  if (a.status === "unavailable") return a;
  if (b.status === "unavailable") return b;
  return {
    status: "available",
    value: {
      retainedCountDelta: b.value.count - a.value.count,
      nativeBytesDelta: b.value.nativeBytes - a.value.nativeBytes,
      baseline: a.value,
      post: b.value,
    },
  };
}
export function retentionForVariant(
  variant: unknown,
  baseline: unknown,
  post: unknown,
  metadata?: unknown,
): ReturnType<typeof retentionDelta> {
  if (typeof variant !== "string" || !variant.startsWith("retention-")) {
    return {
      status: "unavailable",
      reason: "Retention diagnostic not requested for this variant",
    };
  }
  return retentionDelta(baseline, post, metadata);
}
