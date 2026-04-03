import Dexie, { type Table } from 'dexie';

export interface CachedProject {
  id: string;
  name: string;
  code: string;
  status: string;
  updatedAt: string;
}

export interface CachedBoqItem {
  id: string;
  projectId: string;
  boqVersionId: string;
  itemNumber: number;
  description: string;
  sapCode: string | null;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
  sortOrder: number;
  cachedAt: string;
}

export interface PendingMeasurement {
  clientId: string;
  projectId: string;
  boqItemId: string;
  boqItemLabel: string;
  areaName: string;
  nos: number;
  length: number | null;
  breadth: number | null;
  depth: number | null;
  quantity: number;
  unit: string;
  measurementDate: string;
  remarks: string | null;
  isDeduction: boolean;
  createdAt: string;
  syncedAt?: string;
}

export interface SyncQueueItem {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'failed';
  createdAt: string;
  lastError?: string;
}

class MBookOfflineStore extends Dexie {
  projects!: Table<CachedProject, string>;
  boqItems!: Table<CachedBoqItem, string>;
  pendingMeasurements!: Table<PendingMeasurement, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super('mbook-offline-store');
    this.version(1).stores({
      // Why: indexes mirror capture queries (project scoping, pending-only, date grouping).
      projects: 'id, code, name, status, updatedAt',
      boqItems: 'id, projectId, [projectId+sortOrder], [projectId+itemNumber], boqVersionId',
      pendingMeasurements:
        'clientId, projectId, [projectId+syncedAt], [projectId+measurementDate], boqItemId, areaName, createdAt',
      syncQueue: 'id, projectId, status, createdAt',
    });
  }
}

export const offlineStore = new MBookOfflineStore();

function normalizeDimension(value: number | null | undefined): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return value;
}

export function calculateMeasurementQuantity(input: {
  nos?: number;
  length?: number | null;
  breadth?: number | null;
  depth?: number | null;
}): number {
  const nos = input.nos ?? 1;
  const length = input.length ?? 1;
  const breadth = input.breadth ?? 1;
  const depth = input.depth ?? 1;
  return nos * length * breadth * depth;
}

export function newClientId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function cacheProjects(projects: CachedProject[]): Promise<void> {
  await offlineStore.projects.bulkPut(projects);
}

export async function getCachedProjects(): Promise<CachedProject[]> {
  return offlineStore.projects.orderBy('name').toArray();
}

export async function cacheBoqItems(
  projectId: string,
  boqVersionId: string,
  items: Array<Omit<CachedBoqItem, 'projectId' | 'boqVersionId' | 'cachedAt'>>
): Promise<void> {
  const cachedAt = new Date().toISOString();
  await offlineStore.transaction('rw', offlineStore.boqItems, async () => {
    // Why: replace per-project cache atomically to avoid mixing stale and fresh BOQ versions.
    await offlineStore.boqItems.where('projectId').equals(projectId).delete();
    await offlineStore.boqItems.bulkPut(
      items.map((item) => ({
        ...item,
        projectId,
        boqVersionId,
        cachedAt,
      }))
    );
  });
}

export async function getCachedBoqItems(projectId: string): Promise<CachedBoqItem[]> {
  return offlineStore.boqItems.where('projectId').equals(projectId).sortBy('sortOrder');
}

export async function savePendingMeasurement(input: {
  projectId: string;
  boqItemId: string;
  boqItemLabel: string;
  areaName: string;
  nos?: number;
  length?: number | null;
  breadth?: number | null;
  depth?: number | null;
  unit: string;
  measurementDate: string;
  remarks?: string | null;
  isDeduction?: boolean;
}): Promise<PendingMeasurement> {
  const measurement: PendingMeasurement = {
    clientId: newClientId(),
    projectId: input.projectId,
    boqItemId: input.boqItemId,
    boqItemLabel: input.boqItemLabel,
    areaName: input.areaName.trim(),
    nos: input.nos ?? 1,
    length: normalizeDimension(input.length),
    breadth: normalizeDimension(input.breadth),
    depth: normalizeDimension(input.depth),
    quantity: calculateMeasurementQuantity({
      nos: input.nos ?? 1,
      length: input.length,
      breadth: input.breadth,
      depth: input.depth,
    }),
    unit: input.unit.trim(),
    measurementDate: input.measurementDate,
    remarks: input.remarks?.trim() || null,
    isDeduction: input.isDeduction ?? false,
    createdAt: new Date().toISOString(),
  };

  await offlineStore.pendingMeasurements.put(measurement);
  return measurement;
}

export async function getPendingMeasurements(projectId: string): Promise<PendingMeasurement[]> {
  const rows = await offlineStore.pendingMeasurements
    .where('projectId')
    .equals(projectId)
    .toArray();
  return rows
    .filter((row) => !row.syncedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getPendingCountsByBoqItem(projectId: string): Promise<Record<string, number>> {
  const rows = await getPendingMeasurements(projectId);
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.boqItemId] = (acc[row.boqItemId] ?? 0) + 1;
    return acc;
  }, {});
}

export async function markSynced(clientIds: string[]): Promise<void> {
  if (clientIds.length === 0) return;
  const now = new Date().toISOString();
  await offlineStore.transaction('rw', offlineStore.pendingMeasurements, async () => {
    for (const clientId of clientIds) {
      const row = await offlineStore.pendingMeasurements.get(clientId);
      if (!row) continue;
      await offlineStore.pendingMeasurements.put({
        ...row,
        syncedAt: now,
      });
    }
  });
}

export async function getAreaNameSuggestions(
  projectId: string,
  limit = 20
): Promise<string[]> {
  const rows = await offlineStore.pendingMeasurements
    .where('projectId')
    .equals(projectId)
    .toArray();
  rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unique = new Set<string>();
  for (const row of rows) {
    const value = row.areaName.trim();
    if (!value) continue;
    unique.add(value);
    if (unique.size >= limit) break;
  }
  return Array.from(unique);
}
