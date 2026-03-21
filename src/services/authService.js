import { supabase } from './supabase';

export async function signUp({ email, password, name }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw new Error(authError.message);

  const user = authData.user;
  if (!user) throw new Error('Registration failed');

  const role = (email || '').toLowerCase() === 'korshun31@list.ru' ? 'admin' : 'standard';

  const { error: profileError } = await supabase
    .from('agents')
    .insert({
      id: user.id,
      email,
      name: name || '',
      role,
    });

  if (profileError) throw new Error(profileError.message);

  await supabase
    .from('agents')
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
    .from('agents')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return {
    email: '', name: '', lastName: '', phone: '', telegram: '',
    documentNumber: '', extraPhones: [], extraEmails: [], whatsapp: '',
    photoUri: '', role: 'standard', language: 'en',
    notificationSettings: {}, selectedCurrency: 'USD',
    locations: [], workAs: 'private', companyId: null, companyInfo: {}
  };

  // Загружаем активную компанию из таблицы companies (источник правды)
  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  // Проверяем: является ли пользователь участником чужой команды (роль agent)
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role, permissions')
    .eq('agent_id', userId)
    .eq('role', 'agent')
    .maybeSingle();

  // Получаем название компании отдельным запросом если нашли членство
  let memberCompanyName = '';
  if (membershipData?.company_id) {
    const { data: companyRow } = await supabase
      .from('companies')
      .select('name')
      .eq('id', membershipData.company_id)
      .maybeSingle();
    memberCompanyName = companyRow?.name || '';
  }

  const settings = data.settings || {};
  let role = ['standard', 'premium', 'admin'].includes(data.role) ? data.role : 'standard';

  // Участник команды получает Premium (компания платит за всех)
  if (membershipData) role = 'premium';

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
    role,
    language: settings.language || 'en',
    notificationSettings: settings.notificationSettings || {},
    selectedCurrency: settings.selectedCurrency || 'USD',
    locations: Array.isArray(settings.locations) ? settings.locations : [],
    // workAs определяется наличием активной компании, не settings
    workAs: companyData ? 'company' : 'private',
    companyId: companyData?.id || null,
    companyInfo,
    // Если пользователь является участником чужой команды
    teamMembership: membershipData ? {
      companyId: membershipData.company_id,
      companyName: memberCompanyName,
      role: membershipData.role,
    } : null,
    // Разрешения агента в команде
    teamPermissions: membershipData?.permissions || {},
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

  const settingsKeys = ['language', 'notificationSettings', 'selectedCurrency', 'locations', 'workAs', 'companyInfo'];
  const hasSettingsUpdate = settingsKeys.some(k => updates[k] !== undefined);

  if (hasSettingsUpdate) {
    const { data: current } = await supabase
      .from('agents')
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
    .from('agents')
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
