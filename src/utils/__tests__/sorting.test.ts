import { describe, it, expect } from 'vitest';
import {
  defaultSort,
  sortWorkOrders,
  INITIAL_SORT_DIRECTIONS,
} from '@/utils/sorting';
import { STATUS_LABELS, type WorkOrder, type WorkOrderStatus } from '@/types';

function makeOrder(
  overrides: Partial<WorkOrder> & { id: string },
): WorkOrder {
  return {
    location: 'Room A',
    subject: 'Default subject',
    description: 'Default description',
    status: 'active',
    user_id: 'user-1',
    created_by: 'Alice',
    created_by_email: 'alice@robson.com',
    created_by_id: 'user-1',
    created_by_name: 'Alice',
    requester_name: 'Alice',
    assigned_to: null,
    completed_by_technician: null,
    work_performed: null,
    work_order_number: 'WO-2026-0001',
    new_work_order_email_sent_at: null,
    completion_email_sent_at: null,
    completed_at: null,
    created_at: '2026-07-01T10:00:00Z',
    updated_at: '2026-07-01T10:00:00Z',
    ...overrides,
  };
}

describe('STATUS_LABELS formatting', () => {
  it('formats each status with proper casing', () => {
    expect(STATUS_LABELS.active).toBe('Active');
    expect(STATUS_LABELS.waiting_for_parts).toBe('Waiting for Parts');
    expect(STATUS_LABELS.completed).toBe('Completed');
  });

  it('does not expose raw database values as labels', () => {
    for (const label of Object.values(STATUS_LABELS)) {
      expect(label).not.toMatch(/_/);
    }
  });
});

describe('defaultSort', () => {
  const orders: WorkOrder[] = [
    makeOrder({ id: '1', status: 'completed', created_at: '2026-07-10T10:00:00Z' }),
    makeOrder({ id: '2', status: 'active', created_at: '2026-07-05T10:00:00Z' }),
    makeOrder({ id: '3', status: 'waiting_for_parts', created_at: '2026-07-08T10:00:00Z' }),
    makeOrder({ id: '4', status: 'active', created_at: '2026-07-09T10:00:00Z' }),
    makeOrder({ id: '5', status: 'completed', created_at: '2026-07-03T10:00:00Z' }),
  ];

  it('orders Active -> Waiting -> Completed', () => {
    const sorted = defaultSort(orders);
    const statuses = sorted.map((o) => o.status);
    expect(statuses).toEqual([
      'active',
      'active',
      'waiting_for_parts',
      'completed',
      'completed',
    ]);
  });

  it('sorts newest-first within each status group', () => {
    const sorted = defaultSort(orders);
    // Active group: id 4 (Jul 9) before id 2 (Jul 5)
    expect(sorted[0].id).toBe('4');
    expect(sorted[1].id).toBe('2');
    // Completed group: id 1 (Jul 10) before id 5 (Jul 3)
    expect(sorted[3].id).toBe('1');
    expect(sorted[4].id).toBe('5');
  });

  it('moves completed orders below active orders', () => {
    const sorted = defaultSort(orders);
    const firstCompleted = sorted.findIndex((o) => o.status === 'completed');
    const lastActive = sorted.map((o) => o.status).lastIndexOf('active');
    expect(firstCompleted).toBeGreaterThan(lastActive);
  });
});

describe('sortWorkOrders — reversed status order', () => {
  const orders: WorkOrder[] = [
    makeOrder({ id: '1', status: 'active' }),
    makeOrder({ id: '2', status: 'completed' }),
    makeOrder({ id: '3', status: 'waiting_for_parts' }),
  ];

  it('reverses so Completed appears first', () => {
    const sorted = sortWorkOrders(orders, { column: 'status', direction: 'desc' });
    expect(sorted[0].status).toBe('completed');
    expect(sorted[2].status).toBe('active');
  });
});

describe('sortWorkOrders — date sorting', () => {
  const orders: WorkOrder[] = [
    makeOrder({ id: '1', created_at: '2026-07-01T10:00:00Z' }),
    makeOrder({ id: '2', created_at: '2026-07-15T10:00:00Z' }),
    makeOrder({ id: '3', created_at: '2026-07-08T10:00:00Z' }),
  ];

  it('sorts newest-to-oldest (desc)', () => {
    const sorted = sortWorkOrders(orders, { column: 'dateCreated', direction: 'desc' });
    expect(sorted.map((o) => o.id)).toEqual(['2', '3', '1']);
  });

  it('sorts oldest-to-newest (asc)', () => {
    const sorted = sortWorkOrders(orders, { column: 'dateCreated', direction: 'asc' });
    expect(sorted.map((o) => o.id)).toEqual(['1', '3', '2']);
  });
});

describe('sortWorkOrders — description sorting', () => {
  const orders: WorkOrder[] = [
    makeOrder({ id: '1', subject: 'Zebra issue' }),
    makeOrder({ id: '2', subject: 'Alpha issue' }),
    makeOrder({ id: '3', subject: 'Middle issue' }),
  ];

  it('sorts alphabetically (asc)', () => {
    const sorted = sortWorkOrders(orders, { column: 'description', direction: 'asc' });
    expect(sorted.map((o) => o.subject)).toEqual([
      'Alpha issue',
      'Middle issue',
      'Zebra issue',
    ]);
  });

  it('reverses alphabetically (desc)', () => {
    const sorted = sortWorkOrders(orders, { column: 'description', direction: 'desc' });
    expect(sorted.map((o) => o.subject)).toEqual([
      'Zebra issue',
      'Middle issue',
      'Alpha issue',
    ]);
  });

  it('is case-insensitive', () => {
    const mixed: WorkOrder[] = [
      makeOrder({ id: '1', subject: 'banana' }),
      makeOrder({ id: '2', subject: 'Apple' }),
    ];
    const sorted = sortWorkOrders(mixed, { column: 'description', direction: 'asc' });
    expect(sorted[0].subject).toBe('Apple');
  });
});

describe('INITIAL_SORT_DIRECTIONS', () => {
  it('sets sensible defaults per column', () => {
    expect(INITIAL_SORT_DIRECTIONS.description).toBe('asc');
    expect(INITIAL_SORT_DIRECTIONS.status).toBe('asc');
    expect(INITIAL_SORT_DIRECTIONS.assignedTo).toBe('asc');
    expect(INITIAL_SORT_DIRECTIONS.createdBy).toBe('asc');
    expect(INITIAL_SORT_DIRECTIONS.dateCreated).toBe('desc');
  });
});
