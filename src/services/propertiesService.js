import { supabase } from './supabase';
import { syncIfEnabled } from './dataUploadService';

export async function getProperties(agentId = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  let q = supabase
    .from('properties')
    .select('*')
    .order('name', { ascending: true })
    .limit(10000);

  if (agentId) {
    q = q.eq('responsible_agent_id', agentId);
  }

  const { data, error } = await q;

  if (error) {
    console.error('getProperties error:', error.message);
    return [];
  }

  return data || [];
}

export async function createProperty({ name, code, type, location_id, owner_id, property_status }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('properties')
    .insert({
      agent_id: session.user.id,
      responsible_agent_id: session.user.id,
      name: name || '',
      code: code || '',
      type: type || 'house',
      location_id: location_id || null,
      owner_id: owner_id || null,
      property_status: property_status || 'approved',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return data;
}

/** Create a full property (e.g. house in resort) with all fields. */
export async function createPropertyFull(updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const row = {
    agent_id: session.user.id,
    responsible_agent_id: updates.responsible_agent_id ?? session.user.id,
    property_status: updates.property_status || 'approved',
    ...updates,
  };

  const { data, error } = await supabase
    .from('properties')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return data;
}

export async function updateProperty(id, updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .select();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return data?.[0] ?? null;
}

export async function deleteProperty(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
}

/**
 * Update district for all properties in a location that had the old district.
 * Used when renaming or deleting a district in location_districts.
 * Cascades to resort/condo children.
 */
export async function updatePropertiesDistrictForLocation(locationId, oldDistrict, newDistrict) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: props, error: fetchErr } = await supabase
    .from('properties')
    .select('id, type, resort_id')
    .eq('agent_id', session.user.id)
    .eq('location_id', locationId)
    .eq('district', oldDistrict);

  if (fetchErr || !props?.length) {
    syncIfEnabled();
    return;
  }

  const ids = props.map((p) => p.id);
  await supabase
    .from('properties')
    .update({ district: newDistrict || null })
    .in('id', ids)
    .eq('agent_id', session.user.id);

  const resortIds = props.filter((p) => p.type === 'resort' || p.type === 'condo').map((p) => p.id);
  for (const rid of resortIds) {
    await updateResortChildrenDistrict(rid, newDistrict);
  }
  syncIfEnabled();
}

/** Update district for all houses in a resort (cascade when resort district changes). */
export async function updateResortChildrenDistrict(resortId, district) {
  if (!resortId) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: children, error: fetchErr } = await supabase
    .from('properties')
    .select('id')
    .eq('resort_id', resortId)
    .eq('agent_id', session.user.id);

  if (fetchErr || !children?.length) return;
  const ids = children.map((c) => c.id);
  await supabase
    .from('properties')
    .update({ district: district || null })
    .in('id', ids)
    .eq('agent_id', session.user.id);
  syncIfEnabled();
}

/** Admin: назначить ответственного агента (null = Компания). Каскад на детей резорта/кондо. */
export async function updatePropertyResponsible(propertyId, responsibleAgentId, cascade = false) {
  const value = responsibleAgentId ?? null;
  const { data, error } = await supabase
    .from('properties')
    .update({ responsible_agent_id: value })
    .eq('id', propertyId)
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (cascade) {
    // Каскад на дома/апартаменты внутри резорта/кондо
    await supabase
      .from('properties')
      .update({ responsible_agent_id: value })
      .eq('resort_id', propertyId);
  }

  syncIfEnabled();
  return data;
}

export async function approveProperty(propertyId) {
  const { error } = await supabase
    .from('properties')
    .update({ property_status: 'approved' })
    .eq('id', propertyId);
  if (error) throw new Error(error.message);
}

export async function rejectProperty(propertyId, reason) {
  const { error } = await supabase
    .from('properties')
    .update({ property_status: 'rejected', rejection_reason: reason || '' })
    .eq('id', propertyId);
  if (error) throw new Error(error.message);
}

// =============================================================================
// СИСТЕМА ЧЕРНОВИКОВ (Property Drafts)
// Агент отправляет изменения на одобрение Администратору.
// Оригинал в properties НЕ меняется до момента одобрения.
// =============================================================================

/**
 * Отправить черновик изменений объекта на одобрение Администратору.
 * Делает UPSERT — если черновик уже существует, обновляет его.
 * НЕ изменяет таблицу properties.
 *
 * @param {string} propertyId - UUID объекта
 * @param {object} draftData - объект со всеми изменёнными полями
 * @returns {object} запись черновика
 */
export async function submitPropertyDraft(propertyId, draftData) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('property_drafts')
    .upsert(
      {
        property_id: propertyId,
        agent_id: session.user.id,
        draft_data: draftData,
        status: 'pending',
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'property_id,agent_id' }
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Получить активный (pending) черновик текущего агента для указанного объекта.
 *
 * @param {string} propertyId - UUID объекта
 * @returns {object|null} черновик или null
 */
export async function getPropertyDraft(propertyId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data, error } = await supabase
    .from('property_drafts')
    .select('*')
    .eq('property_id', propertyId)
    .eq('agent_id', session.user.id)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('getPropertyDraft error:', error.message);
    return null;
  }

  return data;
}

/**
 * Для Администратора: получить все pending черновики объектов компании.
 * Включает имя объекта, код и имя агента.
 *
 * @param {string} companyId - UUID компании
 * @returns {Array<{draft, propertyName, propertyCode, agentName}>}
 */
export async function getPendingDraftsForAdmin(companyId) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  const { data, error } = await supabase
    .from('property_drafts')
    .select(`
      *,
      properties!inner(name, code, company_id),
      agents:agent_id(id, name, last_name, email)
    `)
    .eq('properties.company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('getPendingDraftsForAdmin error:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    draft: {
      id: row.id,
      property_id: row.property_id,
      agent_id: row.agent_id,
      draft_data: row.draft_data,
      status: row.status,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    propertyName: row.properties?.name || '',
    propertyCode: row.properties?.code || '',
    agentName: [row.agents?.name, row.agents?.last_name]
               .filter(Boolean).join(' ') || row.agents?.email || '',
  }));
}

/**
 * Администратор одобряет черновик: применяет draft_data к объекту,
 * ставит статус черновика 'approved' и property_status объекта 'approved'.
 *
 * @param {string} draftId - UUID черновика
 * @returns {object} обновлённая запись объекта
 */
export async function approvePropertyDraft(draftId) {
  // Загружаем черновик
  const { data: draft, error: draftErr } = await supabase
    .from('property_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (draftErr) throw new Error(draftErr.message);
  if (!draft) throw new Error('Draft not found');

  // Применяем изменения к объекту и одобряем черновик последовательно
  const { data: updatedProperty, error: propErr } = await supabase
    .from('properties')
    .update({ ...draft.draft_data, property_status: 'approved' })
    .eq('id', draft.property_id)
    .select()
    .single();

  if (propErr) throw new Error(propErr.message);

  const { error: approveErr } = await supabase
    .from('property_drafts')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', draftId);

  if (approveErr) throw new Error(approveErr.message);

  syncIfEnabled();
  return updatedProperty;
}

/**
 * Администратор отклоняет черновик: ставит статус 'rejected' с причиной.
 * Данные в properties НЕ меняются. Объект возвращается в статус 'approved'.
 *
 * @param {string} draftId - UUID черновика
 * @param {string} reason - причина отклонения
 */
export async function rejectPropertyDraft(draftId, reason) {
  // Загружаем черновик чтобы получить property_id
  const { data: draft, error: draftErr } = await supabase
    .from('property_drafts')
    .select('property_id')
    .eq('id', draftId)
    .single();

  if (draftErr) throw new Error(draftErr.message);
  if (!draft) throw new Error('Draft not found');

  // Отклоняем черновик
  const { error: rejectErr } = await supabase
    .from('property_drafts')
    .update({
      status: 'rejected',
      rejection_reason: reason || '',
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId);

  if (rejectErr) throw new Error(rejectErr.message);

  syncIfEnabled();
}
