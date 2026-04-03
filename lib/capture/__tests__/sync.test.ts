import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncProjectMeasurements } from "../sync";

const mocks = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  getPendingMeasurementsMock: vi.fn(),
  markSyncedMock: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: mocks.getSessionMock,
    },
  }),
}));

vi.mock("../offline-store", () => ({
  getPendingMeasurements: mocks.getPendingMeasurementsMock,
  markSynced: mocks.markSyncedMock,
}));

describe("syncProjectMeasurements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
    });
  });

  it("returns early when there are no pending rows", async () => {
    mocks.getPendingMeasurementsMock.mockResolvedValue([]);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await syncProjectMeasurements("project-1");

    // Why: skipping network calls for empty queues keeps app resume fast on flaky networks.
    expect(result).toEqual({ synced: 0, duplicates: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocks.markSyncedMock).not.toHaveBeenCalled();
  });

  it("marks accepted client IDs as synced after a successful server response", async () => {
    mocks.getPendingMeasurementsMock.mockResolvedValue([
      {
        clientId: "client-1",
        projectId: "project-1",
        boqItemId: "item-1",
        boqItemLabel: "#1 Item",
        areaName: "Zone A",
        nos: 1,
        length: 2,
        breadth: null,
        depth: null,
        quantity: 2,
        unit: "Nos",
        measurementDate: "2026-02-21",
        remarks: null,
        isDeduction: false,
        createdAt: "2026-02-21T10:00:00Z",
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          synced: 1,
          duplicates: 0,
          idMap: { "client-1": "server-1" },
        },
      }),
    } as Response);

    const result = await syncProjectMeasurements("project-1");

    // Why: idMap-driven marking prevents re-sending already accepted rows on next sync.
    expect(mocks.markSyncedMock).toHaveBeenCalledWith(["client-1"]);
    expect(result).toEqual({ synced: 1, duplicates: 0 });
  });

  it("throws and does not mark local rows when sync endpoint fails", async () => {
    mocks.getPendingMeasurementsMock.mockResolvedValue([
      {
        clientId: "client-2",
        projectId: "project-1",
        boqItemId: "item-1",
        boqItemLabel: "#1 Item",
        areaName: "Zone A",
        nos: 1,
        length: null,
        breadth: null,
        depth: null,
        quantity: 1,
        unit: "Nos",
        measurementDate: "2026-02-21",
        remarks: null,
        isDeduction: false,
        createdAt: "2026-02-21T10:00:00Z",
      },
    ]);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({
        success: false,
        error: "Sync endpoint unavailable",
      }),
    } as Response);

    // Why: rows should remain pending when sync fails so users can retry safely later.
    await expect(syncProjectMeasurements("project-1")).rejects.toThrow(
      "Sync endpoint unavailable"
    );
    expect(mocks.markSyncedMock).not.toHaveBeenCalled();
  });
});
