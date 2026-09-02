import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const MAINTENANCE_INBOX = 'sbrmaintenance@robson.com';

interface WorkOrder {
  id: string;
  work_order_number: string;
  location: string;
  subject: string;
  description: string;
  status: string;
  user_id: string;
  work_performed: string | null;
  created_by: string;
  created_by_email: string;
  created_by_name: string;
  requester_name: string | null;
  assigned_to: string | null;
  completed_by_technician: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  new_work_order_email_sent_at: string | null;
  completion_email_sent_at: string | null;
}

interface RequestBody {
  workOrderId: string;
  type: 'new_work_order' | 'completion';
}

interface ErrorResponse {
  success: false;
  stage: string;
  message: string;
  status: number;
}

interface SuccessResponse {
  success: true;
  sent?: boolean;
  skipped?: boolean;
  reason?: string;
  messageId?: string;
}

function log(stage: string, message: string, extra?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  if (extra) {
    console.log(`[${ts}] [work-order-emails] [${stage}] ${message}`, JSON.stringify(extra));
  } else {
    console.log(`[${ts}] [work-order-emails] [${stage}] ${message}`);
  }
}

function errorResponse(stage: string, message: string, status: number): Response {
  const body: ErrorResponse = { success: false, stage, message, status };
  log(stage, `Returning error ${status}: ${message}`);
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function successResponse(body: SuccessResponse): Response {
  return new Response(JSON.stringify({ success: true, ...body }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  log('function_started', `Request received: ${req.method} ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('method_check', `Method ${req.method} not allowed`, 405);
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
    const RESEND_FROM = Deno.env.get('RESEND_FROM_EMAIL') ?? '';
    const APP_BASE_URL = Deno.env.get('APP_BASE_URL') ?? '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    log('secrets_check', 'Secrets availability', {
      hasResendApiKey: !!RESEND_API_KEY,
      hasResendFrom: !!RESEND_FROM,
      hasAppBaseUrl: !!APP_BASE_URL,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!supabaseServiceKey,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      return errorResponse('secrets_check', 'Supabase URL or service role key is missing', 500);
    }
    if (!RESEND_API_KEY) {
      return errorResponse('secrets_check', 'RESEND_API_KEY is not configured', 500);
    }
    if (!RESEND_FROM) {
      return errorResponse('secrets_check', 'RESEND_FROM_EMAIL is not configured', 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return errorResponse('auth', 'No Authorization header provided', 401);
    }

    const { data: userData, error: jwtError } = await supabase.auth.getUser(jwt);
    if (jwtError || !userData.user) {
      return errorResponse('auth', 'Invalid or expired authentication token', 401);
    }
    log('auth', 'User authenticated', { userId: userData.user.id });

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('body_parse', 'Request body is not valid JSON', 400);
    }

    if (!body?.workOrderId || !body?.type) {
      return errorResponse('body_validation', 'Missing workOrderId or type in request body', 400);
    }
    if (body.type !== 'new_work_order' && body.type !== 'completion') {
      return errorResponse('body_validation', `Invalid email type: ${body.type}`, 400);
    }

    const { data: order, error: orderError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', body.workOrderId)
      .maybeSingle();

    if (orderError) {
      return errorResponse('work_order_fetch', `Database error: ${orderError.message}`, 500);
    }
    if (!order) {
      return errorResponse('work_order_fetch', 'Work order not found', 404);
    }

    const workOrder = order as WorkOrder;
    log('work_order_fetch', 'Work order retrieved', {
      id: workOrder.id,
      workOrderNumber: workOrder.work_order_number,
      status: workOrder.status,
    });

    // Ownership / authorization:
    // - The creator may send emails for their own work orders (new-work-order
    //   notification fires right after creation).
    // - Maintenance / supervisor / admin users complete work orders and trigger
    //   completion emails for orders they did NOT create. Without allowing
    //   these roles here, completion emails never reach Resend — the 403 is
    //   returned before the Resend request is made.
    const isCreator = workOrder.user_id === userData.user.id;
    let isAuthorizedRole = false;
    if (!isCreator) {
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .maybeSingle();
      const callerRole = (callerProfile as { role: string } | null)?.role;
      isAuthorizedRole = callerRole === 'maintenance' || callerRole === 'supervisor' || callerRole === 'admin';
    }

    if (!isCreator && !isAuthorizedRole) {
      return errorResponse('ownership', 'You do not have access to this work order', 403);
    }

    if (body.type === 'new_work_order') {
      return await handleNewWorkOrderEmail(workOrder, supabase, RESEND_API_KEY, RESEND_FROM, APP_BASE_URL);
    } else {
      return await handleCompletionEmail(workOrder, supabase, RESEND_API_KEY, RESEND_FROM, APP_BASE_URL);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('unhandled_error', message);
    return errorResponse('unhandled_error', message, 500);
  }
});

async function handleNewWorkOrderEmail(
  order: WorkOrder,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  from: string,
  appBaseUrl: string,
): Promise<Response> {
  if (order.new_work_order_email_sent_at) {
    log('new_email_check', 'Already sent — skipping');
    return successResponse({ skipped: true, reason: 'already_sent' });
  }

  const existing = await checkExistingLog(supabase, order.id, 'new_work_order', 1);
  if (existing) {
    log('new_email_check', 'Already sent (log table) — skipping');
    return successResponse({ skipped: true, reason: 'already_sent' });
  }

  const recipient = MAINTENANCE_INBOX;
  if (!isValidEmail(recipient)) {
    return errorResponse('recipient_selected', 'Maintenance recipient email is invalid', 400);
  }

  const subject = `New Work Order: ${order.work_order_number} \u2013 ${order.subject}`;
  const link = workOrderLink(order.id, appBaseUrl);
  const html = renderNewWorkOrderHtml(order, link);
  const text = renderNewWorkOrderText(order, link);

  const result = await sendEmail(apiKey, from, recipient, subject, html, text);

  if (result.ok) {
    log('resend_response', 'Email sent', { recipient, messageId: result.messageId });
    await recordSent(supabase, order.id, 'new_work_order', 1, recipient, result.messageId);
    await markColumn(supabase, order.id, { new_work_order_email_sent_at: new Date().toISOString() });
    return successResponse({ sent: true, messageId: result.messageId });
  } else {
    await recordFailed(supabase, order.id, 'new_work_order', 1, recipient, result.error ?? 'unknown');
    return errorResponse('resend_response', result.error ?? 'Email send failed', 500);
  }
}

async function handleCompletionEmail(
  order: WorkOrder,
  supabase: ReturnType<typeof createClient>,
  apiKey: string,
  from: string,
  appBaseUrl: string,
): Promise<Response> {
  if (order.status !== 'completed') {
    return errorResponse('completion_check', 'Work order is not completed', 400);
  }

  const occurrence = await getNextCompletionOccurrence(supabase, order.id);
  log('completion_check', 'Occurrence determined', { occurrence });

  const alreadySent = await checkExistingLog(supabase, order.id, 'completion', occurrence);
  if (alreadySent) {
    log('completion_check', 'Already sent for this occurrence — skipping');
    return successResponse({ skipped: true, reason: 'already_sent' });
  }

  const recipient = order.created_by_email;
  log('recipient_selected', 'Recipient determined (completion)', { recipient });
  if (!recipient || !isValidEmail(recipient)) {
    return errorResponse('recipient_selected', 'No valid recipient email on file for this work order', 400);
  }

  const subject = `Work Order Completed: ${order.work_order_number} \u2013 ${order.subject}`;
  const link = workOrderLink(order.id, appBaseUrl);
  const html = renderCompletionHtml(order, link);
  const text = renderCompletionText(order, link);

  const result = await sendEmail(apiKey, from, recipient, subject, html, text);

  if (result.ok) {
    log('resend_response', 'Completion email sent', { recipient, messageId: result.messageId });
    await recordSent(supabase, order.id, 'completion', occurrence, recipient, result.messageId);
    await markColumn(supabase, order.id, { completion_email_sent_at: new Date().toISOString() });
    return successResponse({ sent: true, messageId: result.messageId });
  } else {
    await recordFailed(supabase, order.id, 'completion', occurrence, recipient, result.error ?? 'unknown');
    return errorResponse('resend_response', result.error ?? 'Email send failed', 500);
  }
}

async function getNextCompletionOccurrence(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('email_notifications')
    .select('occurrence')
    .eq('work_order_id', workOrderId)
    .eq('email_type', 'completion')
    .eq('status', 'sent')
    .order('occurrence', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return 1;
  return data ? (data as { occurrence: number }).occurrence + 1 : 1;
}

async function checkExistingLog(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string,
  emailType: string,
  occurrence: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('email_notifications')
    .select('id')
    .eq('work_order_id', workOrderId)
    .eq('email_type', emailType)
    .eq('occurrence', occurrence)
    .eq('status', 'sent')
    .maybeSingle();

  if (error) return false;
  return !!data;
}

async function recordSent(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string,
  emailType: string,
  occurrence: number,
  recipient: string,
  messageId: string | null,
): Promise<void> {
  const { error } = await supabase.from('email_notifications').insert({
    work_order_id: workOrderId,
    email_type: emailType,
    occurrence,
    recipient,
    status: 'sent',
    provider_message_id: messageId,
  });
  if (error) log('log_record', 'Failed to record sent log', { error: error.message });
}

async function recordFailed(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string,
  emailType: string,
  occurrence: number,
  recipient: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase.from('email_notifications').insert({
    work_order_id: workOrderId,
    email_type: emailType,
    occurrence,
    recipient,
    status: 'failed',
    error_message: errorMessage.slice(0, 2000),
  });
  if (error) log('log_record', 'Failed to record failed log', { error: error.message });
}

async function markColumn(
  supabase: ReturnType<typeof createClient>,
  workOrderId: string,
  fields: { new_work_order_email_sent_at?: string; completion_email_sent_at?: string },
): Promise<void> {
  const { error } = await supabase
    .from('work_orders')
    .update(fields)
    .eq('id', workOrderId);
  if (error) log('mark_column', 'Failed to mark email sent column', { error: error.message });
}

interface SendResult {
  ok: boolean;
  messageId: string | null;
  error: string | null;
}

async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<SendResult> {
  log('resend_request', 'Sending to Resend API', { from, to, subjectLength: subject.length });

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      log('resend_response', 'Resend error', { status: response.status, body: errBody.slice(0, 500) });
      return { ok: false, messageId: null, error: `Resend API error ${response.status}: ${errBody.slice(0, 500)}` };
    }

    const data = await response.json();
    return { ok: true, messageId: data.id ?? null, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('resend_fetch_error', message);
    return { ok: false, messageId: null, error: message };
  }
}

function workOrderLink(id: string, appBaseUrl: string): string {
  if (appBaseUrl) {
    return `${appBaseUrl.replace(/\/$/, '')}/work-orders/${id}`;
  }
  return `https://sbrworkorders.com/work-orders/${id}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function renderNewWorkOrderText(o: WorkOrder, link: string): string {
  return [
    'New Work Order Created',
    '=======================',
    '',
    `Work Order Number: ${o.work_order_number}`,
    `Subject: ${o.subject}`,
    `Location: ${o.location}`,
    `Status: ${o.status}`,
    `Requester Name: ${o.requester_name ?? 'N/A'}`,
    `Created By: ${o.created_by_name}`,
    `Created By Email: ${o.created_by_email}`,
    `Assigned To: ${o.assigned_to ?? 'Unassigned'}`,
    `Date Created: ${formatDate(o.created_at)}`,
    '',
    'Description:',
    o.description,
    '',
    'View this work order:',
    link,
    '',
    '-- Robson Work Orders System',
  ].join('\n');
}

function renderCompletionText(o: WorkOrder, link: string): string {
  return [
    'Work Order Completed',
    '====================',
    '',
    `Work Order Number: ${o.work_order_number}`,
    `Subject: ${o.subject}`,
    `Location: ${o.location}`,
    `Final Status: ${o.status}`,
    `Requester Name: ${o.requester_name ?? 'N/A'}`,
    `Created By: ${o.created_by_name}`,
    `Assigned To: ${o.assigned_to ?? 'Unassigned'}`,
    `Completed By: ${o.completed_by_technician ?? 'N/A'}`,
    `Date Created: ${formatDate(o.created_at)}`,
    `Date Completed: ${formatDate(o.completed_at)}`,
    '',
    'Original Description:',
    o.description,
    '',
    'Work Performed / Completion Notes:',
    o.work_performed?.trim() || 'N/A',
    '',
    'View the completed work order:',
    link,
    '',
    '-- Robson Work Orders System',
  ].join('\n');
}

function renderNewWorkOrderHtml(o: WorkOrder, link: string): string {
  return emailShell({
    heading: 'New Work Order Created',
    accentColor: '#2563eb',
    intro: `A new work order has been submitted by ${escapeHtml(o.requester_name ?? o.created_by_name)}.`,
    rows: [
      ['Work Order Number', escapeHtml(o.work_order_number)],
      ['Subject', escapeHtml(o.subject)],
      ['Location', escapeHtml(o.location)],
      ['Status', escapeHtml(o.status)],
      ['Requester Name', escapeHtml(o.requester_name ?? 'N/A')],
      ['Created By', escapeHtml(o.created_by_name)],
      ['Email', escapeHtml(o.created_by_email)],
      ['Assigned To', escapeHtml(o.assigned_to ?? 'Unassigned')],
      ['Date Created', formatDate(o.created_at)],
    ],
    descriptionBlock: escapeHtml(o.description),
    link,
    linkLabel: 'Open Work Order',
    footer: 'You received this email because a new work order was created in the Robson Work Orders system.',
  });
}

function renderCompletionHtml(o: WorkOrder, link: string): string {
  return emailShell({
    heading: 'Work Order Completed',
    accentColor: '#059669',
    intro: `Work order ${escapeHtml(o.work_order_number)} has been marked as completed.`,
    rows: [
      ['Work Order Number', escapeHtml(o.work_order_number)],
      ['Subject', escapeHtml(o.subject)],
      ['Location', escapeHtml(o.location)],
      ['Final Status', escapeHtml(o.status)],
      ['Requester Name', escapeHtml(o.requester_name ?? 'N/A')],
      ['Created By', escapeHtml(o.created_by_name)],
      ['Assigned To', escapeHtml(o.assigned_to ?? 'Unassigned')],
      ['Completed By', escapeHtml(o.completed_by_technician ?? 'N/A')],
      ['Date Created', formatDate(o.created_at)],
      ['Date Completed', formatDate(o.completed_at)],
    ],
    descriptionBlock: escapeHtml(o.description),
    descriptionLabel: 'Original Description',
    notesLabel: 'Work Performed / Completion Notes',
    notesBlock: escapeHtml(o.work_performed?.trim() || 'N/A'),
    link,
    linkLabel: 'View Completed Work Order',
    footer: 'You received this email because you created this work order and it has been marked as completed.',
  });
}

interface EmailShellProps {
  heading: string;
  accentColor: string;
  intro: string;
  rows: [string, string][];
  descriptionBlock: string;
  link: string;
  linkLabel: string;
  footer: string;
  descriptionLabel?: string;
  notesLabel?: string;
  notesBlock?: string;
}

function emailShell(p: EmailShellProps): string {
  const rowsHtml = p.rows.map(
    ([label, value]) =>
      `<tr><td style="padding:8px 0;color:#64748b;font-size:13px;white-space:nowrap;font-weight:600;">${label}</td><td style="padding:8px 0 8px 16px;color:#1e293b;font-size:14px;">${value}</td></tr>`,
  ).join('\n');

  const notesSection = p.notesBlock
    ? `<tr><td colspan="2" style="padding-top:24px;">
  <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;">${p.notesLabel ?? 'Work Performed'}</p>
  <div style="background:#f8fafc;border-radius:8px;padding:16px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;border:1px solid #e2e8f0;">${p.notesBlock}</div>
</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(p.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:${p.accentColor};padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(p.heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(p.intro)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${rowsHtml}
                <tr><td colspan="2" style="padding-top:20px;">
                  <p style="margin:0 0 8px;color:#64748b;font-size:13px;font-weight:600;">${p.descriptionLabel ?? 'Description'}</p>
                  <div style="background:#f8fafc;border-radius:8px;padding:16px;color:#334155;font-size:14px;line-height:1.6;white-space:pre-wrap;border:1px solid #e2e8f0;">${p.descriptionBlock}</div>
                </td></tr>
                ${notesSection}
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(p.link)}" style="display:inline-block;background:${p.accentColor};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 32px;border-radius:8px;">${escapeHtml(p.linkLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e2e8f0;background:#f8fafc;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">${escapeHtml(p.footer)}</p>
              <p style="margin:8px 0 0;color:#cbd5e1;font-size:11px;">Robson Work Orders System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
