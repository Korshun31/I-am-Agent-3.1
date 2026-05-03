-- Migration: drop legacy users_profile.role column (TD-001)
-- Date: 2026-05-03
-- Description:
--   Колонка дублировала users_profile.plan и больше не использовалась:
--   * триггер handle_new_user перестал писать в неё (миграция 20260503000001).
--   * authService.getUserProfile теперь читает только data.plan.
--   * roleFeatures.js: PLANS вместо ROLES, getPhotoLimitForProperty(plan).
--   * AccountScreen.js, PropertyEditWizard.js: обращаются к user.plan.
--
--   Sandbox-проверка перед DROP (см. отчёт general-purpose):
--   - 20 пользователей, plan IS NOT NULL у всех, plan валиден.
--   - CHECK-констрейнтов на role нет.
--   - RLS-политик и индексов на role нет.
--   - Расхождение role=standard / plan=premium у одного admin'а — норма
--     (plan апгрейднут отдельно, role оставался устаревшим).

ALTER TABLE public.users_profile DROP COLUMN IF EXISTS role;
