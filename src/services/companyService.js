import { supabase } from './supabase';

/**
 * Загружает компанию текущего пользователя (активную или неактивную).
 * Возвращает null если компании нет.
 */
export async function getMyCompany() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from('companies')
    .select('*')
    .eq('owner_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data || null;
}

/**
 * Переключение в режим "Компания":
 * - Если компания уже есть (неактивная) — реактивирует её и обновляет данные
 * - Если нет — создаёт новую запись + добавляет owner в company_members
 * Возвращает ID компании.
 */
export async function activateCompany(companyData = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const userId = session.user.id;

  const dbData = {
    name: companyData.name || '',
    phone: companyData.phone || null,
    email: companyData.email || null,
    logo_url: companyData.logoUrl || null,
    telegram: companyData.telegram || null,
    whatsapp: companyData.whatsapp || null,
    instagram: companyData.instagram || null,
    working_hours: companyData.workingHours || null,
  };

  // Проверяем есть ли уже компания (активная или нет)
  const { data: existing } = await supabase
    .from('companies')
    .select('id, status')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let companyId;

  if (existing) {
    // Реактивируем и обновляем данные
    await supabase
      .from('companies')
      .update({ ...dbData, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    companyId = existing.id;
  } else {
    // Создаём новую
    const { data: created, error } = await supabase
      .from('companies')
      .insert({ ...dbData, owner_id: userId, status: 'active' })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    companyId = created.id;
  }

  // Гарантируем что owner есть в company_members
  await supabase
    .from('company_members')
    .upsert(
      { company_id: companyId, agent_id: userId, role: 'owner' },
      { onConflict: 'company_id,agent_id' }
    );

  return companyId;
}

/**
 * Обновляет данные компании (название, телефон и т.д.)
 */
export async function updateCompany(companyId, companyData) {
  const dbData = {};
  if (companyData.name !== undefined) dbData.name = companyData.name;
  if (companyData.phone !== undefined) dbData.phone = companyData.phone || null;
  if (companyData.email !== undefined) dbData.email = companyData.email || null;
  if (companyData.logoUrl !== undefined) dbData.logo_url = companyData.logoUrl || null;
  if (companyData.telegram !== undefined) dbData.telegram = companyData.telegram || null;
  if (companyData.whatsapp !== undefined) dbData.whatsapp = companyData.whatsapp || null;
  if (companyData.instagram !== undefined) dbData.instagram = companyData.instagram || null;
  if (companyData.workingHours !== undefined) dbData.working_hours = companyData.workingHours || null;
  dbData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('companies')
    .update(dbData)
    .eq('id', companyId);

  if (error) throw new Error(error.message);
}

/**
 * Переключение обратно в режим "Частный агент":
 * - Проверяет нет ли активных агентов в команде
 * - Отзывает неотвеченные приглашения
 * - Деактивирует компанию (status = inactive, данные сохраняются)
 *
 * Выбрасывает 'HAS_ACTIVE_MEMBERS' если в команде есть активные агенты.
 */
export async function deactivateCompany() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const userId = session.user.id;

  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (!company) return;

  // Проверяем есть ли активные агенты (не считая owner)
  const { data: agents } = await supabase
    .from('company_members')
    .select('id')
    .eq('company_id', company.id)
    .eq('role', 'agent');

  if (agents && agents.length > 0) {
    throw new Error('HAS_ACTIVE_MEMBERS');
  }

  // Отзываем неотвеченные приглашения
  await supabase
    .from('company_invitations')
    .update({ status: 'revoked' })
    .eq('company_id', company.id)
    .in('status', ['sent', 'pending']);

  // Деактивируем компанию (данные сохраняются)
  await supabase
    .from('companies')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', company.id);
}

/**
 * Загружает участников команды компании.
 */
export async function getCompanyMembers(companyId) {
  const { data, error } = await supabase
    .from('company_members')
    .select('id, agent_id, role, joined_at')
    .eq('company_id', companyId)
    .order('joined_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Преобразует запись из таблицы companies в объект companyInfo для UI.
 */
export function mapCompanyToInfo(company) {
  if (!company) return {};
  return {
    name: company.name || '',
    phone: company.phone || '',
    email: company.email || '',
    logoUrl: company.logo_url || '',
    telegram: company.telegram || '',
    whatsapp: company.whatsapp || '',
    instagram: company.instagram || '',
    workingHours: company.working_hours || '',
  };
}

const INVITE_BASE_URL = 'https://i-am-agent-3-1.vercel.app';

/**
 * Создаёт приглашение в команду.
 * Проверяет что email не зарегистрирован (личная база защищена).
 * Возвращает ссылку и секретный код для передачи агенту.
 * Выбрасывает 'EMAIL_EXISTS' если email уже в системе.
 */
export async function createInvitation(companyId, email) {
  const normalizedEmail = email.toLowerCase().trim();

  const { data: exists } = await supabase.rpc('check_email_exists', { p_email: normalizedEmail });
  if (exists) throw new Error('EMAIL_EXISTS');

  const { data: code } = await supabase.rpc('generate_secret_code');

  const { data, error } = await supabase
    .from('company_invitations')
    .insert({
      company_id: companyId,
      email: normalizedEmail,
      secret_code: code,
    })
    .select('id, invite_token, secret_code, expires_at')
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    inviteToken: data.invite_token,
    secretCode: data.secret_code,
    expiresAt: data.expires_at,
    inviteLink: `${INVITE_BASE_URL}/?token=${data.invite_token}`,
  };
}

/**
 * Загружает данные команды: участники + активные приглашения.
 */
/** Получить активных участников команды для выпадающего списка "Ответственный". */
export async function getActiveTeamMembers(companyId) {
  const { data, error } = await supabase.rpc('get_company_team', { p_company_id: companyId });
  if (error) throw new Error(error.message);
  return data || [];
}

export async function getTeamData(companyId) {
  const [membersRes, invitationsRes] = await Promise.all([
    supabase.rpc('get_company_team', { p_company_id: companyId }),
    supabase
      .from('company_invitations')
      .select('id, email, status, created_at, expires_at, invite_token, secret_code')
      .eq('company_id', companyId)
      .in('status', ['sent', 'pending'])
      .order('created_at', { ascending: false }),
  ]);

  return {
    members: membersRes.data || [],
    invitations: invitationsRes.data || [],
  };
}

/**
 * Отзывает приглашение (пока не принято).
 */
export async function revokeInvitation(invitationId) {
  const { error } = await supabase
    .from('company_invitations')
    .update({ status: 'revoked' })
    .eq('id', invitationId);
  if (error) throw new Error(error.message);
}

/**
 * Обновить разрешения участника команды.
 */
export async function updateMemberPermissions(memberId, permissions) {
  const { error } = await supabase
    .from('company_members')
    .update({ permissions })
    .eq('id', memberId);
  if (error) throw new Error(error.message);
}

/**
 * Вступить в команду по токену приглашения.
 * Вызывается после успешной авторизации агента.
 */
export async function joinCompanyViaInvitation(token) {
  const { data, error } = await supabase.rpc('join_company_via_invitation', { p_token: token });
  if (error) throw new Error(error.message);
  return data;
}
