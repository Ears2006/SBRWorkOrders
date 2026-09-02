import { supabase } from '@/lib/supabase';

export type EmailType = 'new_work_order' | 'completion';

interface EmailNotificationResponse {
  success?: boolean;
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  message?: string;
  stage?: string;
  messageId?: string;
}

/**
 * Calls the server-side edge function to send a work-order email.
 *
 * The edge function handles:
 * - JWT validation (caller must be authenticated)
 * - Work order ownership verification
 * - Recipient validation (completion emails go to the original creator)
 * - Duplicate prevention via the email_notifications table
 * - Provider API call (Resend)
 *
 * On failure, the work-order mutation is NOT rolled back — the caller
 * should display a non-blocking warning. The failure is logged server-side
 * in the email_notifications table.
 */
export async function sendWorkOrderEmail(
  workOrderId: string,
  type: EmailType,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.access_token) {
      return { ok: false, error: 'No authenticated session' };
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/work-order-emails`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({ workOrderId, type }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return { ok: false, error: errBody.message ?? errBody.error ?? `Request failed (${response.status})` };
    }

    const data: EmailNotificationResponse = await response.json();
    if (data.skipped) {
      return { ok: true, skipped: true };
    }
    if (data.sent || data.success) {
      return { ok: true };
    }
    return { ok: false, error: data.message ?? 'Unknown response' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
