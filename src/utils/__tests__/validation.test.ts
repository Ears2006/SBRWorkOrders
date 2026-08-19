import { describe, it, expect } from 'vitest';
import {
  isApprovedEmailDomain,
  isValidEmailFormat,
  isValidPassword,
  validateWorkOrderForm,
  FIELD_LIMITS,
  PASSWORD_MIN_LENGTH,
} from '@/utils/validation';

describe('isApprovedEmailDomain', () => {
  it('accepts @robson.com', () => {
    expect(isApprovedEmailDomain('user@robson.com')).toBe(true);
  });

  it('accepts subdomains of robson.com', () => {
    expect(isApprovedEmailDomain('user@facilities.robson.com')).toBe(true);
  });

  it('rejects other domains', () => {
    expect(isApprovedEmailDomain('user@gmail.com')).toBe(false);
    expect(isApprovedEmailDomain('user@example.com')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isApprovedEmailDomain('User@ROBSON.COM')).toBe(true);
    expect(isApprovedEmailDomain('User@Robson.Com')).toBe(true);
  });

  it('rejects malformed emails', () => {
    expect(isApprovedEmailDomain('notanemail')).toBe(false);
    expect(isApprovedEmailDomain('@robson.com')).toBe(false);
    expect(isApprovedEmailDomain('user@')).toBe(false);
  });

  it('rejects lookalike domains', () => {
    expect(isApprovedEmailDomain('user@robson.com.evil.com')).toBe(false);
    expect(isApprovedEmailDomain('user@fakerobson.com')).toBe(false);
  });
});

describe('isValidEmailFormat', () => {
  it('accepts standard emails', () => {
    expect(isValidEmailFormat('a@b.com')).toBe(true);
  });

  it('rejects empty or whitespace', () => {
    expect(isValidEmailFormat('')).toBe(false);
    expect(isValidEmailFormat('   ')).toBe(false);
  });

  it('rejects missing @ or domain', () => {
    expect(isValidEmailFormat('noatsign.com')).toBe(false);
    expect(isValidEmailFormat('a@')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts passwords at or above the minimum length', () => {
    expect(isValidPassword('abcdef')).toBe(true);
    expect(isValidPassword('a'.repeat(20))).toBe(true);
  });

  it('rejects passwords below the minimum length', () => {
    expect(isValidPassword('abc')).toBe(false);
    expect(isValidEmailFormat('')).toBe(false);
  });

  it(`uses PASSWORD_MIN_LENGTH of ${PASSWORD_MIN_LENGTH}`, () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });
});

describe('validateWorkOrderForm', () => {
  const valid = {
    location: 'Lap Pool Equipment Room',
    subject: 'Heater not turning on',
    description: 'The heater does not ignite when switched on.',
    requesterName: 'Jane Smith',
  };

  it('passes with valid input', () => {
    const { errors, valid: ok, cleaned } = validateWorkOrderForm(valid);
    expect(ok).toBe(true);
    expect(errors.location).toBeUndefined();
    expect(errors.subject).toBeUndefined();
    expect(errors.description).toBeUndefined();
    expect(errors.requesterName).toBeUndefined();
    expect(cleaned.location).toBe(valid.location);
  });

  it('trims whitespace from all fields', () => {
    const { cleaned } = validateWorkOrderForm({
      location: '  Room  ',
      subject: '  Subject  ',
      description: '  Desc  ',
      requesterName: '  Jane Smith  ',
    });
    expect(cleaned.location).toBe('Room');
    expect(cleaned.subject).toBe('Subject');
    expect(cleaned.description).toBe('Desc');
    expect(cleaned.requesterName).toBe('Jane Smith');
  });

  it('rejects whitespace-only values', () => {
    const { errors, valid: ok } = validateWorkOrderForm({
      location: '   ',
      subject: '   ',
      description: '   ',
      requesterName: '   ',
    });
    expect(ok).toBe(false);
    expect(errors.location).toBeDefined();
    expect(errors.subject).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.requesterName).toBeDefined();
  });

  it('rejects values exceeding limits', () => {
    const { errors, valid: ok } = validateWorkOrderForm({
      location: 'x'.repeat(FIELD_LIMITS.location + 1),
      subject: 'x'.repeat(FIELD_LIMITS.subject + 1),
      description: 'x'.repeat(FIELD_LIMITS.description + 1),
      requesterName: 'x'.repeat(FIELD_LIMITS.requesterName + 1),
    });
    expect(ok).toBe(false);
    expect(errors.location).toBeDefined();
    expect(errors.subject).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(errors.requesterName).toBeDefined();
  });
});
