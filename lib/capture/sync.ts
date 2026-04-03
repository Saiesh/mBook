import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  getPendingMeasurements,
  markSynced,
  type PendingMeasurement,
} from './offline-store';

interface SyncResponse {
  success: boolean;
  data?: {
    synced: number;
    duplicates: number;
    idMap: Record<string, string>;
  };
  error?: string;
}

export interface SyncResult {
  synced: number;
  duplicates: number;
}

function toSyncPayloadRows(rows: PendingMeasurement[]) {
  return rows.map((row) => ({
    clientId: row.clientId,
    boqItemId: row.boqItemId,
    areaName: row.areaName,
    nos: row.nos,
    length: row.length,
    breadth: row.breadth,
    depth: row.depth,
    unit: row.unit,
    measurementDate: row.measurementDate,
    remarks: row.remarks,
    isDeduction: row.isDeduction,
  }));
}

async function getBearerToken(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function syncProjectMeasurements(projectId: string): Promise<SyncResult> {
  const pending = await getPendingMeasurements(projectId);
  if (pending.length === 0) return { synced: 0, duplicates: 0 };

  const token = await getBearerToken();
  const response = await fetch(`/api/projects/${projectId}/measurements/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ measurements: toSyncPayloadRows(pending) }),
  });

  const json = (await response.json()) as SyncResponse;
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to sync pending measurements');
  }

  // Why: idMap keys are accepted client IDs, so this marks both newly inserted and duplicate rows.
  const syncedClientIds = Object.keys(json.data.idMap);
  await markSynced(syncedClientIds);

  return { synced: json.data.synced, duplicates: json.data.duplicates };
}
