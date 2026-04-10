import { supabase } from './supabase';
import { Platform } from 'react-native';

export async function signUp({ email, password, name }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw new Error(authError.message);

  const user = authData.user;
  if (!user) throw new Error('Registration failed');

  const role = (email || '').toLowerCase() === 'korshun31@list.ru' ? 'admin' : 'standard';
  const isOwnerEmail = (email || '').toLowerCase() === 'korshun31@list.ru';

  // Insert without `plan`: column is added by migration 20260330000002; if migration was not
  // applied to remote DB, including `plan` breaks PostgREST ("schema cache" error).
  // When `plan` exists, DEFAULT 'standard' applies; owner gets an optional update below.
  const { error: profileError } = await supabase
    .from('users_profile')
    .insert({
      id: user.id,
      email,
      name: name || '',
      role,
    });

  if (profileError) throw new Error(profileError.message);

  if (isOwnerEmail) {
    const { error: planErr } = await supabase
      .from('users_profile')
      .update({ plan: 'korshun' })
      .eq('id', user.id);
    if (planErr?.message && !planErr.message.includes("'plan'")) {
      console.warn('[authService] agents.plan update failed:', planErr.message);
    }
  }

  await supabase
    .from('users_profile')
    .update({ settings: { language: 'en', selectedCurrency: 'USD' } })
    .eq('id', user.id);

  return getUserProfile(user.id);
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);

  return getUserProfile(data.user.id);
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}

export async function getCurrentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  return getUserProfile(session.user.id);
}

export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('users_profile')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return {
    email: '', name: '', lastName: '', phone: '', telegram: '',
    documentNumber: '', extraPhones: [], extraEmails: [], whatsapp: '',
    photoUri: '', role: 'standard', plan: 'standard', language: 'en',
    notificationSettings: {}, selectedCurrency: 'USD',
    locations: [], workAs: 'private', companyId: null, companyInfo: {},
    teamRole: null, isAgentRole: false, isAdminRole: false,
  };

  // Загружаем активную компанию из таблицы companies (источник правды)
  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // Query all company_members roles so we can derive canonical teamRole.
  // Roles: 'agent' | 'admin' (worker removed). Backward compat: teamMembership
  // still only populated for role='agent'.
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role, permissions')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // Derived role boolean — source of truth for LOCK-001 guards.
  // Roles: 'admin' | 'agent' | null. 'worker' was removed (migration 20260330000003).
  const isAgentMember = membershipData?.role === 'agent';

  // Location access is an agent-specific feature.
  let assignedLocationIds = [];
  if (isAgentMember && membershipData?.company_id) {
    const { data: locationAccess } = await supabase
      .from('agent_location_access')
      .select('location_id')
      .eq('user_id', userId)
      .eq('company_id', membershipData.company_id);
    assignedLocationIds = (locationAccess || []).map(r => r.location_id);
  }

  // Fetch company info for any team member (name + admin id).
  let memberCompanyName = '';
  let memberCompanyOwnerId = null;
  if (membershipData?.company_id) {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('name, owner_id')
      .eq('id', membershipData.company_id)
      .maybeSingle();
    memberCompanyName = companyRow?.name || '';
    memberCompanyOwnerId = companyRow?.owner_id || null;
  }

  const settings = data.settings || {};
  let role = ['standard', 'premium', 'admin'].includes(data.role) ? data.role : 'standard';

  // Only agents receive the company-sponsored premium upgrade (Phase 1 compat).
  // Worker/admin billing handled separately in Phase 2.
  if (isAgentMember) role = 'premium';

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
    // Legacy billing field (kept for backward compat; prefer user.plan in new code).
    role,
    // ── Canonical fields ─────────────────────────────────────────────────────
    // Billing plan: 'standard' | 'premium' | 'korshun'
    plan: data.plan || 'standard',
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
    workAs: companyData ? 'company' : 'private',
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

export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
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

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    // Web: стандартный OAuth redirect через Supabase
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account',
        },
      },
    });
    if (error) throw error;
  } else {
    // Mobile: через expo-auth-session
    const redirectUrl = makeRedirectUri({
      scheme: 'iamagent',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(
      data?.url,
      redirectUrl
    );

    if (result.type === 'success') {
      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      }
    }
  }
}

export async function signInWithFacebook() {
  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  } else {
    const redirectUrl = makeRedirectUri({
      scheme: 'iamagent',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(
      data?.url,
      redirectUrl
    );

    if (result.type === 'success') {
      const url = result.url;
      const params = new URLSearchParams(url.split('#')[1] || url.split('?')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (accessToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) throw sessionError;
      }
    }
  }
}
