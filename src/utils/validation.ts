import type {
  WorkOrder,
  WorkOrderFormData,
  WorkOrderFormErrors,
} from '@/types';

export const FIELD_LIMITS = {
  location: 150,
  subject: 150,
  description: 5000,
  requesterName: 100,
} as const;

export const PASSWORD_MIN_LENGTH = 6;

export const APPROVED_DOMAIN = 'robson.com';

const ALLOWED_EXCEPTION_EMAILS: ReadonlySet<string> = new Set([
  'ejclinton1@gmail.com',
]);

/**
 * Returns true when the email belongs to the approved Robson domain
 * or is an explicitly allowlisted exception email.
 * Case-insensitive. Accepts subdomains if the configured domain is a parent.
 */
export function isApprovedEmailDomain(email: string, domain: string = APPROVED_DOMAIN): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@')) return false;
  const [local, host] = normalized.split('@');
  if (!local || !host) return false;
  if (ALLOWED_EXCEPTION_EMAILS.has(normalized)) return true;
  return host === domain || host.endsWith('.' + domain);
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = email.trim();
  if (!normalized) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH;
}

/**
 * Validates the work-order create form. Trims values and rejects whitespace-only
 * input. Returns per-field error messages plus a cleaned form payload.
 */
export function validateWorkOrderForm(
  form: WorkOrderFormData,
): { errors: WorkOrderFormErrors; valid: boolean; cleaned: WorkOrderFormData } {
  const errors: WorkOrderFormErrors = {};

  const location = form.location.trim();
  const subject = form.subject.trim();
  const description = form.description.trim();
  const requesterName = form.requesterName.trim();

  if (!location) {
    errors.location = 'Location is required.';
  } else if (location.length > FIELD_LIMITS.location) {
    errors.location = `Location must be ${FIELD_LIMITS.location} characters or fewer.`;
  }

  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length > FIELD_LIMITS.subject) {
    errors.subject = `Subject must be ${FIELD_LIMITS.subject} characters or fewer.`;
  }

  if (!description) {
    errors.description = 'Description is required.';
  } else if (description.length > FIELD_LIMITS.description) {
    errors.description = `Description must be ${FIELD_LIMITS.description.toLocaleString()} characters or fewer.`;
  }

  if (!requesterName) {
    errors.requesterName = 'Requester Name is required.';
  } else if (requesterName.length > FIELD_LIMITS.requesterName) {
    errors.requesterName = `Requester Name must be ${FIELD_LIMITS.requesterName} characters or fewer.`;
  }

  const valid = Object.keys(errors).length === 0;
  return { errors, valid, cleaned: { location, subject, description, requesterName } };
}
