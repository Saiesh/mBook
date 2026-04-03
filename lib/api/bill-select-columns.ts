/**
 * Shared explicit select lists for RA bill API routes.
 * Why: keeps bill handlers aligned with schema without `select('*')`.
 */
export const RA_BILL_ROW_SELECT =
  'id, project_id, bill_number, bill_sequence, boq_version_id, created_by, created_at, updated_at, deleted_at';

export const BILL_VERSION_ROW_SELECT =
  'id, ra_bill_id, version_type, version_number, source, sub_total, tax_rate, tax_amount, grand_total, excel_url, notes, created_by, created_at';

export const BILL_VERSION_LINE_ITEM_SELECT =
  'id, bill_version_id, boq_item_id, previous_quantity, current_quantity, cumulative_quantity, rate, previous_amount, current_amount, cumulative_amount, created_at';

export const MEASUREMENT_LINKED_SELECT =
  'id, project_id, boq_item_id, area_name, nos, length, breadth, depth, quantity, unit, measurement_date, remarks, is_deduction, created_by, client_id, synced_at, created_at, updated_at, deleted_at';
