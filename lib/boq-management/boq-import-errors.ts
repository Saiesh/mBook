/**
 * Maps known BOQ import failures to HTTP status + message.
 * Why: extracted from the route so handlers stay thin and tests can import the mapper.
 */
export function mapBOQImportError(error: unknown): { status: number; message: string } | null {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (
    message.includes('uq_boq_item_per_version') ||
    message.includes('uq_boq_item_per_section') ||
    (message.includes('duplicate key value') && message.includes('boq_items'))
  ) {
    return {
      status: 400,
      message:
        'BOQ upload contains duplicate item numbers within the same section. Please keep item numbers unique per section and try again.',
    };
  }

  return null;
}
