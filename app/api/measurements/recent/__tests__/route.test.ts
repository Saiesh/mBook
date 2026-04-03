import { describe, expect, it } from "vitest";
import { groupRecentMeasurements } from "../route";

describe("recent measurements grouping", () => {
  it("groups rows by date then project and caps preview rows", () => {
    const grouped = groupRecentMeasurements({
      rows: [
        {
          id: "m-4",
          project_id: "project-a",
          measurement_date: "2026-02-20",
          area_name: "Area 4",
          quantity: 4,
          unit: "Nos",
          created_at: "2026-02-20T13:00:00Z",
        },
        {
          id: "m-3",
          project_id: "project-a",
          measurement_date: "2026-02-20",
          area_name: "Area 3",
          quantity: 3,
          unit: "Nos",
          created_at: "2026-02-20T12:00:00Z",
        },
        {
          id: "m-2",
          project_id: "project-a",
          measurement_date: "2026-02-20",
          area_name: "Area 2",
          quantity: 2,
          unit: "Nos",
          created_at: "2026-02-20T11:00:00Z",
        },
        {
          id: "m-1",
          project_id: "project-b",
          measurement_date: "2026-02-21",
          area_name: "Area 1",
          quantity: 1,
          unit: "Nos",
          created_at: "2026-02-21T10:00:00Z",
        },
      ],
      projectById: new Map([
        ["project-a", { id: "project-a", name: "Alpha", code: "ALP-01" }],
        ["project-b", { id: "project-b", name: "Beta", code: "BET-01" }],
      ]),
      previewPerProject: 2,
    });

    // Why: landing cards must remain ordered by newest date for quick latest-first scanning.
    expect(grouped.map((row) => row.date)).toEqual(["2026-02-21", "2026-02-20"]);

    expect(grouped[0]?.projects).toEqual([
      {
        projectId: "project-b",
        projectName: "Beta",
        projectCode: "BET-01",
        count: 1,
        preview: [
          {
            id: "m-1",
            areaName: "Area 1",
            quantity: 1,
            unit: "Nos",
            createdAt: "2026-02-21T10:00:00Z",
          },
        ],
      },
    ]);

    const alphaGroup = grouped[1]?.projects[0];
    expect(alphaGroup?.projectName).toBe("Alpha");
    // Why: full row count should include all records even when preview intentionally shows fewer.
    expect(alphaGroup?.count).toBe(3);
    expect(alphaGroup?.preview.map((row) => row.id)).toEqual(["m-4", "m-3"]);
  });

  it("uses fallback metadata when project lookup is missing", () => {
    const grouped = groupRecentMeasurements({
      rows: [
        {
          id: "m-unknown",
          project_id: "project-missing",
          measurement_date: "2026-02-22",
          area_name: "Retaining wall",
          quantity: 5,
          unit: "m3",
          created_at: "2026-02-22T10:00:00Z",
        },
      ],
      projectById: new Map(),
      previewPerProject: 3,
    });

    // Why: cards should still render safely even when a project record is soft-deleted.
    expect(grouped).toEqual([
      {
        date: "2026-02-22",
        projects: [
          {
            projectId: "project-missing",
            projectName: "Unknown Project",
            projectCode: "N/A",
            count: 1,
            preview: [
              {
                id: "m-unknown",
                areaName: "Retaining wall",
                quantity: 5,
                unit: "m3",
                createdAt: "2026-02-22T10:00:00Z",
              },
            ],
          },
        ],
      },
    ]);
  });
});
