import { describe, expect, it } from 'vitest';
import { aggregateByBoqItem, insertVersionAndLineItemsAtomic, mapBillUploadError } from '../route';

type DbError = { message: string } | null;

class FakeSupabaseClient {
  public rpcName: string | null = null;
  public rpcArgs: Record<string, unknown> | null = null;

  constructor(
    private readonly options: {
      rpcError?: string;
    } = {}
  ) {}

  from(_table: string): any {
    throw new Error('from() should not be called by atomic RPC helper');
  }

  // Why: match SupabaseClient.rpc optional-args typing so the fake is assignable to BillUploadAtomicRpcClient.
  async rpc(
    fn: string,
    args: Record<string, unknown> = {}
  ): Promise<{ data: unknown; error: DbError }> {
    this.rpcName = fn;
    this.rpcArgs = args;

    if (this.options.rpcError) {
      return { data: null, error: { message: this.options.rpcError } };
    }

    return {
      data: {
        id: 'version-1',
        ra_bill_id: args.p_bill_id,
        version_type: 'generated',
      },
      error: null,
    };
  }
}

describe('bill upload route helpers', () => {
  it('aggregates duplicate Abstract rows by boqItemId before insert', () => {
    const aggregated = aggregateByBoqItem([
      {
        boqItemId: 'boq-1',
        previousQuantity: 1,
        currentQuantity: 2,
        cumulativeQuantity: 3,
        rate: 10,
        previousAmount: 10,
        currentAmount: 20,
        cumulativeAmount: 30,
      },
      {
        boqItemId: 'boq-1',
        previousQuantity: 4,
        currentQuantity: 5,
        cumulativeQuantity: 9,
        rate: 10,
        previousAmount: 40,
        currentAmount: 50,
        cumulativeAmount: 90,
      },
      {
        boqItemId: 'boq-2',
        previousQuantity: 2,
        currentQuantity: 1,
        cumulativeQuantity: 3,
        rate: 8,
        previousAmount: 16,
        currentAmount: 8,
        cumulativeAmount: 24,
      },
    ]);

    // Why: guards the regression where duplicate mapped rows triggered
    // uq_bill_version_item and aborted uploads.
    expect(aggregated).toHaveLength(2);
    expect(aggregated).toContainEqual({
      boqItemId: 'boq-1',
      previousQuantity: 5,
      currentQuantity: 7,
      cumulativeQuantity: 12,
      rate: 10,
      previousAmount: 50,
      currentAmount: 70,
      cumulativeAmount: 120,
    });
    expect(aggregated).toContainEqual({
      boqItemId: 'boq-2',
      previousQuantity: 2,
      currentQuantity: 1,
      cumulativeQuantity: 3,
      rate: 8,
      previousAmount: 16,
      currentAmount: 8,
      cumulativeAmount: 24,
    });
  });

  it('creates generated version + line items through one atomic RPC', async () => {
    const db = new FakeSupabaseClient();

    const result = await insertVersionAndLineItemsAtomic(db, {
      versionInput: {
        billId: 'bill-1',
        taxRate: 18,
        taxAmount: 18,
        grandTotal: 118,
        subTotal: 100,
        notes: null,
        excelUrl: 'bill.xlsx',
        createdBy: 'user-1',
      },
      lineItems: [
        {
          boqItemId: 'boq-1',
          previousQuantity: 1,
          currentQuantity: 2,
          cumulativeQuantity: 3,
          rate: 10,
          previousAmount: 10,
          currentAmount: 20,
          cumulativeAmount: 30,
        },
      ],
    });

    // Why: one DB function call guarantees parent+child writes are transactional.
    expect(db.rpcName).toBe('create_generated_bill_version_atomic');
    expect((db.rpcArgs?.p_line_items as unknown[] | undefined)?.length).toBe(1);
    expect(result.lineItemCount).toBe(1);
  });

  it('surfaces RPC failures as generated-version creation failures', async () => {
    const db = new FakeSupabaseClient({ rpcError: 'uq_bill_version_item' });

    await expect(
      insertVersionAndLineItemsAtomic(db, {
        versionInput: {
          billId: 'bill-1',
          taxRate: 18,
          taxAmount: 18,
          grandTotal: 118,
          subTotal: 100,
          notes: null,
          excelUrl: 'bill.xlsx',
          createdBy: 'user-1',
        },
        lineItems: [
          {
            boqItemId: 'boq-1',
            previousQuantity: 1,
            currentQuantity: 2,
            cumulativeQuantity: 3,
            rate: 10,
            previousAmount: 10,
            currentAmount: 20,
            cumulativeAmount: 30,
          },
        ],
      })
    ).rejects.toThrow('Failed to create generated bill version: uq_bill_version_item');
  });

  it('maps duplicate bill line-item constraint failures to a 400 validation response', () => {
    const mapped = mapBillUploadError(
      new Error('Failed to create generated bill version: duplicate key value violates unique constraint "uq_bill_version_item"')
    );

    // Why: prevents leaking raw DB constraint text and gives users a direct fix.
    expect(mapped).toEqual({
      status: 400,
      message:
        'Uploaded Abstract has duplicate rows for the same BOQ item. Please keep a single row per BOQ item (or pre-aggregate duplicates) and upload again.',
    });
  });

  it('does not map unknown bill upload failures', () => {
    // Why: unknown server failures should remain 5xx and not be mislabeled as input issues.
    expect(mapBillUploadError(new Error('Failed to verify bill: timeout'))).toBeNull();
  });
});
