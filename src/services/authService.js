import { supabase } from './supabase';

export async function signUp({ email, password, name }) {
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw new Error(authError.message);

  const user = authData.user;
  if (!user) throw new Error('Registration failed');

  const { error: profileError } = await supabase
    .from('agents')
    .insert({
      id: user.id,
      email,
      name: name || '',
    });

  if (profileError) throw new Error(profileError.message);

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

  if (error) return { email: '', name: '', lastName: '', phone: '', telegram: '', documentNumber: '', extraPhones: [], extraEmails: [], whatsapp: '', photoUri: '' };

  const settings = data.settings || {};
  const companyInfo = settings.companyInfo || {};
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
    language: settings.language || '',
    notificationSettings: settings.notificationSettings || {},
    selectedCurrency: settings.selectedCurrency || '',
    locations: Array.isArray(settings.locations) ? settings.locations : [],
    workAs: settings.workAs === 'company' ? 'company' : 'private',
    companyInfo,
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
