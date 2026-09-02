import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  MapPin,
  Mail,
  User,
  UserCog,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/contexts/ToastContext';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusDropdown } from '@/components/StatusDropdown';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { ErrorMessage } from '@/components/ErrorMessage';
import {
  fetchWorkOrderById,
  updateWorkOrderStatus,
  completeWorkOrder,
  assignWorkOrder,
  fetchWorkOrderUpdates,
  addWorkOrderUpdate,
} from '@/services/workOrders';
import { sendWorkOrderEmail } from '@/services/emailNotifications';
import { formatDateTimeLong, relativeTime } from '@/lib/format';
import {
  canCompleteWorkOrder,
  canAssignTechnician,
  canAddWorkUpdate,
} from '@/utils/permissions';
import {
  TECHNICIANS,
  STATUS_LABELS,
  type WorkOrder,
  type WorkOrderStatus,
  type WorkOrderUpdate,
} from '@/types';
import { PhotoGallery } from '@/components/PhotoGallery';

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;

  const role = profile?.role ?? null;
  const mayComplete = canCompleteWorkOrder(role);
  const mayAssign = canAssignTechnician(role);
  const mayAddUpdate = canAddWorkUpdate(role);

  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [updates, setUpdates] = useState<WorkOrderUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status change (non-completed, non-waiting-for-parts)
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(!!justCreated);

  // Completion modal/section
  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completeTech, setCompleteTech] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  // Assignment
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Work Update modal (for Waiting for Parts and add-update)
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateText, setUpdateText] = useState('');
  const [updateStatus, setUpdateStatus] = useState<WorkOrderStatus>('waiting_for_parts');
  const [submittingUpdate, setSubmittingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  // When set, the modal is driven by a status dropdown change (vs. manual add).
  const [pendingStatusChange, setPendingStatusChange] = useState<WorkOrderStatus | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchWorkOrderById(id), fetchWorkOrderUpdates(id)])
      .then(([data, updateData]) => {
        if (!active) return;
        if (!data) {
          setError('This work order could not be found. It may have been removed.');
        } else {
          setOrder(data);
          setUpdates(updateData);
        }
      })
      .catch((err: unknown) => {
        console.error('Failed to load work order:', err);
        if (active) setError('Could not load this work order. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (showSuccess) {
      const t = setTimeout(() => setShowSuccess(false), 4000);
      return () => clearTimeout(t);
    }
  }, [showSuccess]);

  async function handleStatusChange(next: WorkOrderStatus) {
    if (!order || order.status === next || updatingStatus) return;

    if (next === 'completed') {
      setShowCompleteForm(true);
      setCompleteError(null);
      return;
    }

    // Waiting for Parts requires a progress update note.
    if (next === 'waiting_for_parts') {
      setUpdateText('');
      setUpdateStatus('waiting_for_parts');
      setUpdateError(null);
      setPendingStatusChange(next);
      setShowUpdateModal(true);
      return;
    }

    // Other status changes (e.g. back to Active) proceed directly.
    const prev = order.status;
    setStatusError(null);
    setUpdatingStatus(true);
    setOrder({ ...order, status: next });
    try {
      const updated = await updateWorkOrderStatus(order.id, next);
      setOrder(updated);
      showToast(`Status changed to ${STATUS_LABELS[next]}.`, 'success');
    } catch (err) {
      console.error('Status update failed:', err);
      setOrder({ ...order, status: prev });
      const msg = err instanceof Error ? err.message : 'Could not update the status.';
      setStatusError(msg);
      showToast('Could not update the status.', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  }

  function openAddUpdateModal() {
    setUpdateText('');
    setUpdateStatus('waiting_for_parts');
    setUpdateError(null);
    setPendingStatusChange(null);
    setShowUpdateModal(true);
  }

  function closeUpdateModal() {
    setShowUpdateModal(false);
    setPendingStatusChange(null);
    setUpdateText('');
    setUpdateError(null);
  }

  async function handleSubmitUpdate() {
    if (!order) return;
    setUpdateError(null);

    if (!updateText.trim()) {
      setUpdateError('A work update note is required.');
      return;
    }

    setSubmittingUpdate(true);
    try {
      const updated = await addWorkOrderUpdate(order.id, updateText.trim(), updateStatus);
      setOrder(updated);
      const fresh = await fetchWorkOrderUpdates(order.id);
      setUpdates(fresh);
      setShowUpdateModal(false);
      setUpdateText('');
      setPendingStatusChange(null);
      showToast('Work update saved.', 'success');
    } catch (err) {
      console.error('Work update failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not save the work update.';
      setUpdateError(msg);
      showToast('Could not save the work update.', 'error');
    } finally {
      setSubmittingUpdate(false);
    }
  }

  async function handleComplete() {
    if (!order) return;
    setCompleteError(null);

    if (!completeTech.trim()) {
      setCompleteError('Please select the technician who completed the work.');
      return;
    }
    if (!completeNotes.trim()) {
      setCompleteError('Work Performed is required before completing.');
      return;
    }

    setCompleting(true);
    try {
      const updated = await completeWorkOrder(order.id, completeNotes.trim(), completeTech.trim());
      setOrder(updated);
      setShowCompleteForm(false);
      showToast(`Status changed to ${STATUS_LABELS.completed}.`, 'success');

      sendWorkOrderEmail(order.id, 'completion').then((result) => {
        if (!result.ok && !result.skipped) {
          console.warn('Completion email failed:', result.error);
          showToast('Status saved, but the completion email could not be sent.', 'error');
        } else if (result.ok && !result.skipped) {
          showToast('Completion email sent to the work order creator.', 'success');
        }
      });
    } catch (err) {
      console.error('Completion failed:', err);
      const msg = err instanceof Error ? err.message : 'Could not complete the work order.';
      setCompleteError(msg);
      showToast('Could not complete the work order.', 'error');
    } finally {
      setCompleting(false);
    }
  }

  async function handleAssign(technician: string) {
    if (!order) return;
    setAssignError(null);
    setAssigning(true);
    const prevAssigned = order.assigned_to;
    setOrder({ ...order, assigned_to: technician || null });
    try {
      const updated = await assignWorkOrder(order.id, technician || null);
      setOrder(updated);
      showToast(
        technician ? `Work order assigned to ${technician}.` : 'Work order unassigned.',
        'success',
      );
    } catch (err) {
      console.error('Assignment failed:', err);
      setOrder({ ...order, assigned_to: prevAssigned });
      const msg = err instanceof Error ? err.message : 'Could not assign the work order.';
      setAssignError(msg);
      showToast('Could not assign the work order.', 'error');
    } finally {
      setAssigning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <BackLink onClick={() => navigate('/work-orders')} />
        <LoadingIndicator label="Loading work order…" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto">
        <BackLink onClick={() => navigate('/work-orders')} />
        <div className="rounded-2xl bg-white ring-1 ring-slate-200 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-600">{error ?? 'Work order not found.'}</p>
          <Link
            to="/work-orders"
            className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Return to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = order.status === 'completed';

  return (
    <div className="max-w-4xl mx-auto">
      <BackLink onClick={() => navigate('/work-orders')} />

      {showSuccess && (
        <div
          role="status"
          className="mb-5 flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden />
          Work order created successfully.
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <StatusBadge status={order.status} />
            <span className="font-mono text-sm font-semibold text-slate-700 bg-slate-100 rounded-lg px-3 py-1 self-start sm:self-auto">
              {order.work_order_number}
            </span>
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{order.subject}</h1>
        </div>

        <div className="p-6 sm:p-8 space-y-8">
          {/* Key info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <MetaItem icon={User} label="Requester" value={order.requester_name} />
            <MetaItem icon={UserCog} label="Assigned To" value={order.assigned_to ?? 'Unassigned'} />
            <MetaItem icon={MapPin} label="Location" value={order.location} />
            <MetaItem icon={Mail} label="Created By" value={order.requester_name} />
            <MetaItem icon={Mail} label="Email" value={order.created_by_email} />
            <MetaItem
              icon={Calendar}
              label="Date Created"
              value={formatDateTimeLong(order.created_at)}
              sub={relativeTime(order.created_at)}
            />
            <MetaItem
              icon={CalendarClock}
              label="Last Updated"
              value={formatDateTimeLong(order.updated_at)}
              sub={relativeTime(order.updated_at)}
            />
          </div>

          {/* Assignment section */}
          {!isCompleted && (
            <div className="pt-2 border-t border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-slate-400" aria-hidden />
                Assigned Technician
              </h2>
              {mayAssign ? (
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={order.assigned_to ?? ''}
                    onChange={(e) => handleAssign(e.target.value)}
                    disabled={assigning}
                    aria-label="Assign technician"
                    className="appearance-none rounded-lg border-0 bg-white py-2.5 pl-3.5 pr-10 text-sm font-medium text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Unassigned</option>
                    {TECHNICIANS.map((tech) => (
                      <option key={tech} value={tech}>
                        {tech}
                      </option>
                    ))}
                  </select>
                  {assigning && <Loader2 className="h-4 w-4 text-slate-400 animate-spin" aria-hidden />}
                </div>
              ) : (
                <p className="text-sm text-slate-600">
                  {order.assigned_to ?? 'Unassigned'}
                </p>
              )}
              {assignError && (
                <div className="mt-3">
                  <ErrorMessage message={assignError} />
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Description</h2>
            <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-4 ring-1 ring-slate-100">
              {order.description}
            </p>
          </div>

          {/* Photos */}
          <PhotoGallery workOrderId={order.id} />

          {/* Work Updates (progress history) */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" aria-hidden />
                Work Updates
              </h2>
              {mayAddUpdate && !isCompleted && (
                <button
                  onClick={openAddUpdateModal}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add Update
                </button>
              )}
            </div>

            {updates.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No work updates have been recorded yet.
              </p>
            ) : (
              <ol className="space-y-4">
                {updates.map((u) => (
                  <li
                    key={u.id}
                    className="relative pl-6 border-l-2 border-slate-100"
                  >
                    <div className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white" />
                    <div className="bg-slate-50 rounded-xl p-4 ring-1 ring-slate-100">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <StatusBadge status={u.status} />
                        <span className="text-xs text-slate-400">
                          {formatDateTimeLong(u.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {u.update_text}
                      </p>
                      <p className="mt-2 text-xs font-medium text-slate-500">
                        {u.created_by_name ?? 'Maintenance Technician'}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Work Performed + Completion info */}
          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Work Performed</h2>
            {isCompleted ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed bg-emerald-50 rounded-xl p-4 ring-1 ring-emerald-100">
                  {order.work_performed?.trim() || 'No notes were recorded.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-9 w-9 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center shrink-0">
                      <Wrench className="h-4 w-4 text-emerald-600" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Technician Who Completed Work</p>
                      <p className="text-sm text-slate-800 break-words">{order.completed_by_technician ?? 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-9 w-9 rounded-lg bg-emerald-50 ring-1 ring-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Completed At</p>
                      <p className="text-sm text-slate-800 break-words">
                        {order.completed_at ? formatDateTimeLong(order.completed_at) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : showCompleteForm && mayComplete ? (
              <div className="space-y-4 bg-blue-50/50 rounded-xl p-4 ring-1 ring-blue-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Complete this work order</p>
                  <button
                    onClick={() => {
                      setShowCompleteForm(false);
                      setCompleteError(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition"
                    aria-label="Cancel completion"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
                <div>
                  <label htmlFor="complete-tech" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Technician Who Completed Work <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="complete-tech"
                    value={completeTech}
                    onChange={(e) => {
                      setCompleteTech(e.target.value);
                      setCompleteError(null);
                    }}
                    className="appearance-none w-full rounded-lg border-0 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition"
                  >
                    <option value="">Select technician…</option>
                    {TECHNICIANS.map((tech) => (
                      <option key={tech} value={tech}>
                        {tech}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="complete-notes" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Work Performed <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="complete-notes"
                    value={completeNotes}
                    onChange={(e) => {
                      setCompleteNotes(e.target.value);
                      setCompleteError(null);
                    }}
                    rows={5}
                    placeholder="Describe the work completed on this order."
                    className="w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition resize-y min-h-[120px]"
                  />
                </div>
                {completeError && <ErrorMessage message={completeError} />}
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {completing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Mark as Completed
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">
                {mayComplete
                  ? 'No work has been recorded yet. Use the status selector to complete this order.'
                  : 'Work performed notes will appear here once a maintenance technician completes this order.'}
              </p>
            )}
          </div>

          {/* Status section */}
          <div className="pt-2 border-t border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Work Order Status</h2>
            <StatusDropdown
              value={order.status}
              onChange={handleStatusChange}
              disabled={updatingStatus}
            />
            {statusError && (
              <div className="mt-3">
                <ErrorMessage message={statusError} />
              </div>
            )}
            {!mayComplete && (
              <p className="mt-2 text-xs text-slate-400">
                Only maintenance, supervisor, and admin roles can mark a work order as completed.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Work Update modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl ring-1 ring-slate-200 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {pendingStatusChange ? 'Work Update Required' : 'Add Work Update'}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {pendingStatusChange === 'waiting_for_parts'
                    ? 'Document the work performed, parts needed, and ordering status before setting this order to Waiting for Parts.'
                    : 'Record progress on this work order. The update will appear in the Work Updates history.'}
                </p>
              </div>
              <button
                onClick={closeUpdateModal}
                className="text-slate-400 hover:text-slate-600 transition shrink-0"
                aria-label="Close"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {!pendingStatusChange && (
                <div>
                  <label htmlFor="update-status" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Status
                  </label>
                  <select
                    id="update-status"
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value as WorkOrderStatus)}
                    className="appearance-none w-full rounded-lg border-0 bg-white py-2.5 pl-3.5 pr-10 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition"
                  >
                    <option value="waiting_for_parts">Waiting for Parts</option>
                    <option value="active">Active</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="update-text" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Work Update / Progress Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="update-text"
                  value={updateText}
                  onChange={(e) => {
                    setUpdateText(e.target.value);
                    setUpdateError(null);
                  }}
                  rows={6}
                  placeholder={
                    'Document:\n• Work or troubleshooting performed\n• Problem discovered\n• Parts needed\n• Whether parts were ordered\n• Date parts were ordered\n• Any other information needed before work can continue'
                  }
                  className="w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition resize-y min-h-[140px]"
                />
              </div>

              {updateError && <ErrorMessage message={updateError} />}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  onClick={closeUpdateModal}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitUpdate}
                  disabled={submittingUpdate}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submittingUpdate && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {pendingStatusChange === 'waiting_for_parts'
                    ? 'Save Update & Set to Waiting for Parts'
                    : 'Save Update'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-4"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to dashboard
    </button>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-9 w-9 rounded-lg bg-slate-50 ring-1 ring-slate-100 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-slate-400" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-800 break-words">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
