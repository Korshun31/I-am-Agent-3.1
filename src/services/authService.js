import { supabase } from './supabase';
import { Platform } from 'react-native';
import { isDisposableEmail } from '../utils/disposableEmails';

export async function signUp({ email, password, name }) {
  if (isDisposableEmail(email)) {
    throw new Error('DISPOSABLE_EMAIL');
  }

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw new Error(authError.message);

  const user = authData.user;
  if (!user) throw new Error('Registration failed');

  // TD-015: если в Supabase Dashboard включена email-confirmation, signUp
  // не возвращает session — юзер должен подтвердить почту через письмо.
  // Возвращаем спец-объект, чтобы UI показал экран «Проверьте почту»
  // вместо main. Профиль не создаём здесь: триггер handle_new_user в БД
  // делает это сам, а users_profile пуст до подтверждения — это норма.
  if (!authData.session) {
    return { pendingConfirmation: true, email };
  }

  // Триггер handle_new_user уже создал profile с дефолтными settings
  // (language=en, selectedCurrency=USD). Перезаписываем только name —
  // signUp не передаёт его в auth metadata, поэтому в триггере name
  // получился равным email.
  const { error: profileError } = await supabase
    .from('users_profile')
    .update({ name: name || '' })
    .eq('id', user.id);

  if (profileError) throw new Error(profileError.message);

  return getUserProfile(user.id);
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // TD-015: Supabase возвращает «Email not confirmed» для непрошедших
    // подтверждение. Прокидываем спец-код, чтобы UI показал понятный текст.
    const msg = error.message || '';
    if (msg.toLowerCase().includes('email not confirmed')
        || msg.toLowerCase().includes('email not verified')) {
      throw new Error('EMAIL_NOT_CONFIRMED');
    }
    throw new Error(msg);
  }

  const profile = await getUserProfile(data.user.id);
  if (!profile) {
    // Auth user exists but no users_profile — orphan account.
    // Sign out and refuse: account is incomplete and must not get into CRM.
    try { await supabase.auth.signOut(); } catch {}
    throw new Error('PROFILE_NOT_FOUND');
  }
  return profile;
}

// scope: 'local' (default) — только текущая сессия; 'global' — все устройства юзера.
export async function signOut({ scope = 'local' } = {}) {
  // Очищаем DataUpload-конфиг при выходе — иначе на устройстве может остаться
  // настройка от предыдущего юзера, и следующий вход будет триггерить чужой sync.
  try {
    const { stopUpload } = require('./dataUploadService');
    await stopUpload();
  } catch {}

  const { error } = await supabase.auth.signOut({ scope });
  if (error) throw new Error(error.message);
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return getUserProfile(session.user.id);
}

export async function getUserProfile(userId) {
  // TD-035: один RPC вместо 5 последовательных запросов.
  const { data: full, error } = await supabase.rpc('get_full_user_profile', { p_user_id: userId });

  if (error) {
    console.warn('[getUserProfile] RPC error:', error.message);
    return null;
  }
  if (!full || !full.profile) {
    // orphan auth user — auth.users row есть, users_profile ещё нет
    return null;
  }

  const data = full.profile;
  const companyData = full.ownedCompany || null;
  const membershipData = full.membership || null;
  const isAgentMember = membershipData?.role === 'agent';
  const assignedLocationIds = Array.isArray(full.assignedLocationIds) ? full.assignedLocationIds : [];
  const memberCompanyName = full.memberCompany?.name || '';
  const memberCompanyOwnerId = full.memberCompany?.owner_id || null;

  const settings = data.settings || {};
  // TD-001: тариф читаем строго из data.plan. Колонка users_profile.role была
  // удалена как мусорный дубль — миграция 20260503000002.
  let plan = ['standard', 'premium', 'korshun'].includes(data.plan) ? data.plan : 'standard';

  // Агенту-члену команды компания спонсирует premium-апгрейд.
  if (isAgentMember) plan = 'premium';

  // Данные компании: из таблицы companies (если есть) или из settings как запасной вариант
  const companyInfo = companyData ? {
    name: companyData.name || '',
    phone: companyData.phone || '',
    email: companyData.email || '',
    logoUrl: companyData.logo_url || '',
    telegram: companyData.telegram || '',
    whatsapp: companyData.whatsapp || '',
    instagram: companyData.instagram || '',
    workingHours: companyData.working_hours || '',
  } : (settings.companyInfo || {});

  return {
    id: data.id,
    email: data.email || '',
    name: data.name || '',
    lastName: data.last_name || '',
    phone: data.phone || '',
    telegram: data.telegram || '',
    whatsapp: data.whatsapp || '',
    documentNumber: data.document_number || '',
    photoUri: data.photo_url || '',
    extraPhones: [],
    extraEmails: [],
    // ── Canonical fields ─────────────────────────────────────────────────────
    // Billing plan: 'standard' | 'premium' | 'korshun'
    plan,
    // Team role inside company_members: 'agent' | 'admin' | null
    teamRole: membershipData?.role ?? null,
    // Role predicates — use these in guards instead of !!teamMembership checks.
    isAgentRole: isAgentMember,
    isAdminRole: !!companyData,
    // ─────────────────────────────────────────────────────────────────────────
    language: Platform.OS === 'web'
      ? (settings.web_language || 'en')
      : (settings.app_language || 'en'),
    notificationSettings: settings.notificationSettings || {},
    selectedCurrency: settings.selectedCurrency || 'USD',
    locations: Array.isArray(settings.locations) ? settings.locations : [],
    // workAs определяется наличием активной компании, не settings
    workAs: (companyData && companyData.name && companyData.name.trim()) ? 'company' : 'private',
    companyId: companyData?.id || null,
    companyInfo,
    // Backward compat: teamMembership populated ONLY for role='agent'.
    // New code should use user.teamRole directly.
    teamMembership: isAgentMember ? {
      companyId: membershipData.company_id,
      companyName: memberCompanyName,
      role: membershipData.role,
      adminId: memberCompanyOwnerId,
      assignedLocationIds,
    } : null,
    // Backward compat: teamPermissions populated only for agents.
    teamPermissions: isAgentMember ? (membershipData?.permissions || {}) : {},
    web_notifications: data.web_notifications || {
      new_booking: false,
      booking_changed: false,
      new_event: false,
      new_property: false
    },
  };
}

export async function updateUserProfile(updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const dbUpdates = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.lastName !== undefined) dbUpdates.last_name = updates.lastName;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.telegram !== undefined) dbUpdates.telegram = updates.telegram;
  if (updates.whatsapp !== undefined) dbUpdates.whatsapp = updates.whatsapp;
  if (updates.documentNumber !== undefined) dbUpdates.document_number = updates.documentNumber;
  if (updates.photoUri !== undefined) dbUpdates.photo_url = updates.photoUri;
  if (updates.web_notifications !== undefined) dbUpdates.web_notifications = updates.web_notifications;

  const settingsKeys = ['language', 'web_language', 'app_language', 'notificationSettings', 'selectedCurrency', 'locations', 'workAs', 'companyInfo'];
  const hasSettingsUpdate = settingsKeys.some(k => updates[k] !== undefined);

  if (hasSettingsUpdate) {
    const { data: current } = await supabase
      .from('users_profile')
      .select('settings')
      .eq('id', session.user.id)
      .single();

    const currentSettings = (current && current.settings) || {};
    const newSettings = { ...currentSettings };
    for (const key of settingsKeys) {
      if (updates[key] !== undefined) newSettings[key] = updates[key];
    }
    dbUpdates.settings = newSettings;
  }

  const { error } = await supabase
    .from('users_profile')
    .update(dbUpdates)
    .eq('id', session.user.id);

  if (error) throw new Error(error.message);

  return getUserProfile(session.user.id);
}

/**
 * TD-014: запрос ссылки для сброса пароля. Supabase отправляет письмо с magic link;
 * после клика пользователь попадает на recovery-страницу где может задать новый пароль.
 * На вебе redirectTo = текущий origin → onAuthStateChange('PASSWORD_RECOVERY') в App.js
 * подхватит событие и покажет экран UpdatePassword.
 */
export async function requestPasswordReset(email) {
  const trimmed = (email || '').trim();
  if (!trimmed) throw new Error('Email is required');
  const options = {};
  if (typeof window !== 'undefined' && window.location?.origin) {
    options.redirectTo = window.location.origin;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, options);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** TD-014: установка нового пароля после клика по recovery-ссылке. */
export async function setNewPassword(newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
  return { ok: true };
}

/** Returns true if user signed up with email/password (can change password). */
export async function canChangePassword() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const identities = user.identities || [];
  const hasEmailProvider = identities.some((id) => id?.provider === 'email');
  const hasOAuthOnly = identities.some((id) =>
    ['google', 'apple', 'facebook'].includes(id?.provider || '')
  );
  if (hasOAuthOnly && !hasEmailProvider) return false;
  return hasEmailProvider || identities.length === 0;
}

/** Re-auth with current password, then update to new password. */
export async function updatePassword(currentPassword, newPassword) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.email) throw new Error('Not authenticated');

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password: currentPassword,
  });
  if (signInError) throw new Error(signInError.message);

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) throw new Error(updateError.message);
}

export async function deleteOwnAccount() {
  const { data, error } = await supabase.rpc('delete_own_account');
  if (error) throw new Error(error.message);
  return data;
}
