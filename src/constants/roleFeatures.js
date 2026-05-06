/**
 * Plan-based feature limits and permissions.
 * Plans: standard, premium, korshun
 * (TD-001: переименовано из ROLE.ADMIN в PLAN.KORSHUN — каноничное значение
 *  `users_profile.plan`. Старая колонка `role` удалена.)
 */

export const PLANS = {
  STANDARD: 'standard',
  PREMIUM: 'premium',
  KORSHUN: 'korshun',
};

/** Max photos per property by plan */
const PHOTO_LIMIT_BY_PLAN = {
  [PLANS.STANDARD]: 10,
  [PLANS.PREMIUM]: 30,
  [PLANS.KORSHUN]: 30,
};

export function getPhotoLimitForProperty(plan) {
  return PHOTO_LIMIT_BY_PLAN[plan] ?? 10;
}
