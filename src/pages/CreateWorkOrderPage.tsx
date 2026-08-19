import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/contexts/ToastContext';
import { createWorkOrder } from '@/services/workOrders';
import { sendWorkOrderEmail } from '@/services/emailNotifications';
import { validateWorkOrderForm, FIELD_LIMITS } from '@/utils/validation';
import { PhotoUploader } from '@/components/PhotoUploader';
import { uploadWorkOrderPhotos, type PendingPhoto } from '@/services/photos';

const { location: MAX_LOCATION, subject: MAX_SUBJECT, description: MAX_DESCRIPTION, requesterName: MAX_REQUESTER } = FIELD_LIMITS;

export function CreateWorkOrderPage() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { showToast } = useToast();

  const [location, setLocation] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [requesterName, setRequesterName] = useState('');
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const descLen = description.length;
  const descOver = descLen > MAX_DESCRIPTION;

  const canSubmit =
    location.trim().length > 0 &&
    subject.trim().length > 0 &&
    description.trim().length > 0 &&
    requesterName.trim().length > 0 &&
    !descOver &&
    !submitting &&
    !uploadingPhotos;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (!user) {
      setError('Your session has expired. Please sign in again.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { errors, valid, cleaned } = validateWorkOrderForm({ location, subject, description, requesterName });
      if (!valid) {
        const firstError = errors.location ?? errors.subject ?? errors.description ?? errors.requesterName ?? 'Please fix the errors above.';
        throw new Error(firstError);
      }

      const created = await createWorkOrder({
        location: cleaned.location,
        subject: cleaned.subject,
        description: cleaned.description,
        requesterName: cleaned.requesterName,
        createdByName: profile?.email ?? 'Team Member',
        createdByEmail: profile?.email ?? user.email ?? '',
      });

      if (pendingPhotos.length > 0) {
        setUploadingPhotos(true);
        try {
          await uploadWorkOrderPhotos(created.id, pendingPhotos);
        } catch (uploadErr) {
          console.error('Photo upload failed:', uploadErr);
          showToast('Work order created, but some photos could not be uploaded.', 'error');
        } finally {
          setUploadingPhotos(false);
        }
      }

      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));

      // Fire-and-forget the new-work-order email. Don't block navigation —
      // if it fails, the server logs it and the work order is still saved.
      sendWorkOrderEmail(created.id, 'new_work_order').then((result) => {
        if (!result.ok && !result.skipped) {
          console.warn('New work order email failed:', result.error);
        }
      });

      showToast('Work order created successfully.', 'success');
      navigate(`/work-orders/${created.id}`, { replace: true, state: { justCreated: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to create the work order.';
      console.error('Work order creation failed:', err);
      setError(friendlyError(msg));
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/work-orders')}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition mb-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create Work Order</h1>
          <p className="mt-1 text-sm text-slate-500">
            Fill in the details below. New orders start as{' '}
            <span className="font-medium text-blue-700">Active</span>.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-6 sm:p-8 space-y-6"
        noValidate
      >
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="requester-name" className="text-sm font-medium text-slate-700">
              Requester Name <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-400">
              {requesterName.length}/{MAX_REQUESTER}
            </span>
          </div>
          <input
            id="requester-name"
            type="text"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value.slice(0, MAX_REQUESTER))}
            maxLength={MAX_REQUESTER}
            placeholder="Jane Smith"
            className={inputClass}
            required
          />
          <p className="mt-1 text-xs text-slate-400">
            The employee submitting this request.
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="location" className="text-sm font-medium text-slate-700">
              Location <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-400">
              {location.length}/{MAX_LOCATION}
            </span>
          </div>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value.slice(0, MAX_LOCATION))}
            maxLength={MAX_LOCATION}
            placeholder="Lap Pool Equipment Room"
            className={inputClass}
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="subject" className="text-sm font-medium text-slate-700">
              Subject <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-slate-400">
              {subject.length}/{MAX_SUBJECT}
            </span>
          </div>
          <input
            id="subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value.slice(0, MAX_SUBJECT))}
            maxLength={MAX_SUBJECT}
            placeholder="Lap pool heater is not turning on"
            className={inputClass}
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="description" className="text-sm font-medium text-slate-700">
              Description <span className="text-red-500">*</span>
            </label>
            <span className={`text-xs ${descOver ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
              {descLen}/{MAX_DESCRIPTION.toLocaleString()}
            </span>
          </div>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION))}
            maxLength={MAX_DESCRIPTION}
            rows={6}
            placeholder="Describe the problem clearly. Include when it started, any error indicators, and anything you've already tried."
            className={`${inputClass} resize-y min-h-[140px]`}
            required
          />
          {descOver && (
            <p className="mt-1 text-xs text-red-600">
              Description exceeds the {MAX_DESCRIPTION.toLocaleString()} character limit.
            </p>
          )}
        </div>

        <PhotoUploader
          photos={pendingPhotos}
          onAdd={(photo) => setPendingPhotos((prev) => [...prev, photo])}
          onRemove={(index) =>
            setPendingPhotos((prev) => {
              URL.revokeObjectURL(prev[index].previewUrl);
              return prev.filter((_, i) => i !== index);
            })
          }
          uploading={uploadingPhotos}
        />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 ring-1 ring-inset ring-red-600/20"
          >
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/work-orders')}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || uploadingPhotos}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting || uploadingPhotos ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {uploadingPhotos ? 'Uploading photos…' : 'Submit Work Order'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border-0 bg-white px-3.5 py-2.5 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-blue-600 transition';

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('row-level security') || m.includes('rls')) {
    return 'You must be signed in to create a work order. Please sign in and try again.';
  }
  return msg;
}

