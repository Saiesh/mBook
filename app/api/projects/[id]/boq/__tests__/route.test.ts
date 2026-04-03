import { describe, expect, it } from 'vitest';
import { mapBOQImportError } from '@/lib/boq-management/boq-import-errors';

describe('boq route error mapping', () => {
  it('maps duplicate BOQ item constraint failures to a 400 validation response', () => {
    const mapped = mapBOQImportError(
      new Error('Failed to batch-create items: duplicate key value violates unique constraint "uq_boq_item_per_section"')
    );

    // Why: operators need a clear correction path instead of low-level SQL errors.
    expect(mapped).toEqual({
      status: 400,
      message:
        'BOQ upload contains duplicate item numbers within the same section. Please keep item numbers unique per section and try again.',
    });
  });

  it('does not map unknown BOQ import failures', () => {
    // Why: preserve 5xx semantics for unexpected server-side faults.
    expect(mapBOQImportError(new Error('No worksheet found in the uploaded file'))).toBeNull();
  });
});
