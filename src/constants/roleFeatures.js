/**
 * Role-based feature limits and permissions.
 * Roles: standard, premium, admin
 */

export const ROLES = {
  STANDARD: 'standard',
  PREMIUM: 'premium',
  ADMIN: 'admin',
};

/** Max photos per property by role */
const PHOTO_LIMIT_BY_ROLE = {
  [ROLES.STANDARD]: 10,
  [ROLES.PREMIUM]: 30,
  [ROLES.ADMIN]: 30,
};

export function getPhotoLimitForProperty(role) {
  return PHOTO_LIMIT_BY_ROLE[role] ?? 10;
}
