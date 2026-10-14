/**
 * Centralized Role Security & Demotion Manager
 * Ensures accounts flagged for demotion are strictly stripped of admin privileges and treated as normal users.
 */

export const DEMOTED_TO_NORMAL_USERS = [
  'selfrole_1783853030461_4jdl3o@example.com',
  'probe.r8.2026@gmail.com',
  'pentest_test_2026@imchat.im',
  'yilin199924@gmail.com',
  'r16probe1788304828@xmail.co',
  'wei34432ming@gmail.com',
  'ctfhacker777@example.com'
].map(email => email.toLowerCase());

export const OFFICIAL_OWNER_EMAILS = [
  'mobilephonesky987@gmail.com',
  'contact@imchat.im'
].map(email => email.toLowerCase());

export type UserRoleType = 'user' | 'admin' | 'vip' | 'moderator' | 'robot' | 'team' | 'restricted' | 'content_creator';

/**
 * Checks if an email address is in the list of accounts explicitly demoted to normal users.
 */
export function isDemotedUser(email?: string | null): boolean {
  if (!email) return false;
  return DEMOTED_TO_NORMAL_USERS.includes(email.trim().toLowerCase());
}

/**
 * Sanitizes a role string. If the user's email is flagged for demotion, forces 'user'.
 */
export function sanitizeUserRole<T extends string = string>(role?: T | null, email?: string | null): T {
  if (isDemotedUser(email)) {
    return 'user' as T;
  }
  return (role || 'user') as T;
}

/**
 * Validates whether the user is an authorized administrator.
 * Rejects any demoted accounts unconditionally.
 */
export function isAuthorizedAdmin(role?: string | null, email?: string | null): boolean {
  if (!email && !role) return false;
  if (isDemotedUser(email)) return false;

  const normalizedEmail = (email || '').trim().toLowerCase();
  if (OFFICIAL_OWNER_EMAILS.includes(normalizedEmail)) {
    return true;
  }

  return role === 'admin';
}
