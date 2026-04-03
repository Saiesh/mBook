import { describe, expect, it } from "vitest";
import {
  buildPendingMeasurementInput,
  parseAddMeasurementInput,
  type AddMeasurementFormState,
} from "../page";

function createBaseForm(overrides: Partial<AddMeasurementFormState> = {}): AddMeasurementFormState {
  return {
    areaName: "North edge",
    nos: "2",
    length: "3.5",
    breadth: "",
    depth: "",
    unit: "Nos",
    remarks: "Initial pass",
    isDeduction: false,
    ...overrides,
  };
}

describe("dialog submission helpers", () => {
  it("validates numeric fields and returns parsed values", () => {
    const parsed = parseAddMeasurementInput(createBaseForm());

    // Why: dialog submit should normalize user-entered strings into numeric payload fields.
    expect(parsed).toEqual({
      areaName: "North edge",
      nos: 2,
      length: 3.5,
      breadth: null,
      depth: null,
      unit: "Nos",
      remarks: "Initial pass",
      isDeduction: false,
    });
  });

  it("builds save payload with BOQ item context and selected date", () => {
    const payload = buildPendingMeasurementInput({
      projectId: "project-1",
      safeDate: "2026-02-21",
      activeAddItem: {
        id: "item-1",
        itemNumber: 1,
        description: "Excavation",
      } as never,
      form: createBaseForm(),
    });

    // Why: the queue payload must include BOQ label + date so retry syncs remain deterministic.
    expect(payload).toMatchObject({
      projectId: "project-1",
      boqItemId: "item-1",
      boqItemLabel: "#1 Excavation",
      areaName: "North edge",
      nos: 2,
      length: 3.5,
      breadth: null,
      depth: null,
      unit: "Nos",
      measurementDate: "2026-02-21",
      remarks: "Initial pass",
      isDeduction: false,
    });
  });

  it("rejects non-positive nos values", () => {
    // Why: invalid zero/negative NOS should fail fast before writing corrupted offline rows.
    expect(() => parseAddMeasurementInput(createBaseForm({ nos: "0" }))).toThrow(
      "NOS must be a positive number"
    );
  });
});
