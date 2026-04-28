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
    // Реактивируем: если данные переданы — обновляем, иначе только меняем статус
    const hasData = Object.values(companyData).some(v => v !== undefined && v !== null && v !== '');
    const updatePayload = hasData
      ? { ...dbData, status: 'active', updated_at: new Date().toISOString() }
      : { status: 'active', updated_at: new Date().toISOString() };
    await supabase
      .from('companies')
      .update(updatePayload)
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

  // Гарантируем что admin (владелец) есть в company_members
  await supabase
    .from('company_members')
    .upsert(
      { company_id: companyId, user_id: userId, role: 'admin' },
      { onConflict: 'company_id,user_id' }
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

  // Проверяем есть ли активные агенты (не считая admin)
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
    .select('id, user_id, role, joined_at')
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

/**
 * Создаёт приглашение в команду через Edge Function `invite-agent`.
 * Бэк сам проверяет права админа, свободность email, rate-limit
 * и шлёт magic-link через Supabase Auth + наш Email Template.
 * Параметр companyId сейчас не используется (бэк определяет company по JWT админа),
 * оставлен для обратной совместимости вызовов.
 *
 * Бросает Error с понятным сообщением. Возможные коды (берутся из Edge Function):
 *  - EMAIL_OCCUPIED        — email уже зарегистрирован в системе
 *  - EMAIL_OCCUPIED_ORPHAN — email занят неактивным auth-аккаунтом, нужен другой
 *  - RATE_LIMITED          — превышен лимит 10 приглашений в минуту
 *  - NOT_ADMIN             — вызывающий не является admin компании
 *  - COMPANY_NOT_ACTIVATED — у компании пустое поле name
 */
export async function createInvitation(companyId, email) {
  return invokeInviteAgent({ email, resend: false });
}

/**
 * Перевыпускает magic-link для уже существующего приглашения по тому же email.
 * Используется кнопкой "Отправить повторно" в карточке приглашения,
 * когда оригинальная ссылка просрочена (24 часа от выдачи).
 * Бэк находит запись по email + company, обновляет expires_at и status='sent',
 * шлёт письмо с прежним invite_token.
 *
 * Бросает Error если активного приглашения нет (INVITATION_NOT_FOUND).
 */
export async function resendInvitation(email) {
  return invokeInviteAgent({ email, resend: true });
}

async function invokeInviteAgent(payload) {
  const normalizedEmail = (payload.email || '').toLowerCase().trim();
  if (!normalizedEmail) throw new Error('EMAIL_REQUIRED');

  const { data, error } = await supabase.functions.invoke('invite-agent', {
    body: { email: normalizedEmail, resend: payload.resend === true },
  });

  if (error) {
    let code = 'UNKNOWN';
    let serverMessage = error.message || '';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const parsed = await error.context.json();
        if (parsed && typeof parsed === 'object') {
          code = parsed.code || code;
          serverMessage = parsed.error || serverMessage;
        }
      } catch (_) {}
    }
    const e = new Error(serverMessage || 'Failed to send invitation');
    e.code = code;
    throw e;
  }

  if (!data || data.success !== true) {
    const e = new Error((data && data.error) || 'Invitation failed');
    e.code = (data && data.code) || 'UNKNOWN';
    throw e;
  }

  return {
    email: data.email,
    inviteToken: data.invite_token,
    companyName: data.company_name,
    resent: data.resent === true,
  };
}

/**
 * Загружает данные команды: участники + активные приглашения.
 */
/** Получить активных участников команды для выпадающего списка "Ответственный".
 *  RPC `get_company_team` возвращает всех — включая deactivated. Фильтруем
 *  по status='active' на клиенте, чтобы пикеры не показывали уволенных
 *  агентов (B21). Метод `getTeamData` ниже намеренно НЕ фильтрует —
 *  админу в общем списке нужны и неактивные. */
export async function getActiveTeamMembers(companyId) {
  const { data, error } = await supabase.rpc('get_company_team', { p_company_id: companyId });
  if (error) throw new Error(error.message);
  return (data || []).filter(m => m.status === 'active');
}

export async function getTeamData(companyId) {
  const [membersRes, invitationsRes] = await Promise.all([
    supabase.rpc('get_company_team', { p_company_id: companyId }),
    supabase
      .from('company_invitations')
      .select('id, email, status, created_at, expires_at, invite_token, secret_code, attempts')
      .eq('company_id', companyId)
      .in('status', ['sent', 'pending', 'revoked'])
      .order('created_at', { ascending: false }),
  ]);

  return {
    members: membersRes.data || [],
    invitations: invitationsRes.data || [],
  };
}

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
 * Soft deactivate: перевести агента в status='inactive'.
 * Снимает доступ к локациям и переназначает responsible_agent_id через SQL-функцию.
 * auth.users НЕ удаляется.
 */
export async function deactivateMember(companyId, userId) {
  const { error } = await supabase.rpc('deactivate_member', {
    p_company_id: companyId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

/**
 * Получить ID локаций, доступных агенту в компании (через agent_location_access).
 */
export async function getAgentLocationAccess(userId, companyId) {
  const { data, error } = await supabase
    .from('agent_location_access')
    .select('location_id')
    .eq('user_id', userId)
    .eq('company_id', companyId);
  if (error) return [];
  return (data || []).map(r => r.location_id);
}

/**
 * Установить доступные локации агента в компании (через agent_location_access).
 * Полная замена: сначала удаляем все, затем вставляем новые.
 */
export async function setAgentLocationAccess(userId, companyId, locationIds) {
  const { error: deleteError } = await supabase
    .from('agent_location_access')
    .delete()
    .eq('user_id', userId)
    .eq('company_id', companyId);
  if (deleteError) throw new Error(deleteError.message);

  if (!locationIds || locationIds.length === 0) return;
  const rows = locationIds.map(location_id => ({ user_id: userId, company_id: companyId, location_id }));
  const { error } = await supabase.from('agent_location_access').insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Вступить в команду по токену приглашения.
 * Вызывается после успешной авторизации агента.
 */
export async function joinCompanyViaInvitation(token) {
  const { data, error } = await supabase.rpc('join_company_via_invitation', { p_token: token });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  // RPC returns joined_company_id / joined_company_name (avoids plpgsql OUT-param shadowing company_id)
  const cid = row?.joined_company_id ?? row?.company_id;
  const cname = row?.joined_company_name ?? row?.company_name;
  return row && (cid != null || cname != null) ? { companyId: cid, companyName: cname } : null;
}
