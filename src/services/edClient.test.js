import { describe, expect, it } from 'vitest';
import { isSessionExpiredError } from './edClient';

describe('isSessionExpiredError', () => {
  it('recognizes expired-session status codes', () => {
    expect(isSessionExpiredError({ code: 520 })).toBe(true);
    expect(isSessionExpiredError({ code: 525 })).toBe(true);
  });

  it('recognizes an expired-session message', () => {
    expect(isSessionExpiredError({ message: 'Session expirée' })).toBe(true);
  });

  it('does not expire a healthy response', () => {
    expect(isSessionExpiredError({ code: 200, message: 'OK' })).toBe(false);
  });
});