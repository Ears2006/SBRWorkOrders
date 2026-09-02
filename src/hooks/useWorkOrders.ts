import { useCallback, useEffect, useState } from 'react';
import { fetchWorkOrders } from '@/services/workOrders';
import type { WorkOrder } from '@/types';

interface UseWorkOrdersResult {
  orders: WorkOrder[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads all work orders for the signed-in user once on mount.
 * Exposes a `refetch` for manual refresh after mutations.
 */
export function useWorkOrders(): UseWorkOrdersResult {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchWorkOrders()
      .then((data) => {
        setOrders(data);
      })
      .catch((err: unknown) => {
        console.error('Failed to load work orders:', err);
        setError('Could not load work orders. Please try again.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, loading, error, refetch: load };
}
