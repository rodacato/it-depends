import type { Topology, TopologyChange } from './schema';

export class TopologyError extends Error {}

export function cloneTopology(t: Topology): Topology {
  return {
    districts: t.districts.map((d) => ({ ...d })),
    components: t.components.map((c) => ({ ...c })),
    connections: t.connections.map((c) => ({ ...c })),
  };
}

export function applyTopologyChange(topology: Topology, change: TopologyChange): Topology {
  const next = cloneTopology(topology);
  switch (change.op) {
    case 'addDistrict':
      if (!next.districts.some((d) => d.id === change.district.id)) next.districts.push({ ...change.district });
      return next;
    case 'removeDistrict':
      next.districts = next.districts.filter((d) => d.id !== change.id);
      return next;
    case 'addComponent':
      // Upsert in place: a later chapter may add what an earlier choice built, and order drives the layout.
      upsert(next.components, { ...change.component });
      return next;
    case 'updateComponent': {
      const target = next.components.find((c) => c.id === change.id);
      if (!target) throw new TopologyError(`component ${change.id} not found`);
      Object.assign(target, change.set);
      return next;
    }
    case 'removeComponent':
      next.components = next.components.filter((c) => c.id !== change.id);
      next.connections = next.connections.filter((c) => c.from !== change.id && c.to !== change.id);
      return next;
    case 'addConnection':
      upsert(next.connections, { ...change.connection });
      return next;
    case 'removeConnection':
      next.connections = next.connections.filter((c) => c.id !== change.id);
      return next;
  }
}

function upsert<T extends { id: string }>(list: T[], item: T): void {
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = item;
  else list.push(item);
}

export function applyTopologyChanges(topology: Topology, changes: readonly TopologyChange[]): Topology {
  return changes.reduce(applyTopologyChange, topology);
}

// 'clients' is the outside world: the edge every public road starts from.
export const CLIENTS_NODE = 'clients';

export function validateTopology(t: Topology): string[] {
  const problems: string[] = [];
  const componentIds = new Set(t.components.map((c) => c.id));
  const districtIds = new Set(t.districts.map((d) => d.id));
  for (const c of t.components) {
    if (c.kind === 'vendor' && c.district) problems.push(`vendor ${c.id} cannot live inside district ${c.district}`);
    if (c.kind !== 'vendor' && !c.district) problems.push(`component ${c.id} needs a district`);
    if (c.district && !districtIds.has(c.district)) problems.push(`component ${c.id} refers to missing district ${c.district}`);
  }
  for (const k of t.connections) {
    for (const end of [k.from, k.to]) {
      if (end !== CLIENTS_NODE && !componentIds.has(end)) problems.push(`connection ${k.id} refers to missing ${end}`);
    }
  }
  return problems;
}
