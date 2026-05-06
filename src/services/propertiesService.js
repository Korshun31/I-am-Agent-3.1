import { supabase } from './supabase';
import { syncIfEnabled } from './dataUploadService';
import { broadcastChange } from './companyChannel';
import { deletePhotoFromStorage } from './storageService';
import { sendNotification } from './notificationsService';

// TD-051: whitelist of fields the client is allowed to write to `properties`.
// Server-only fields (id, user_id, company_id, created_at, updated_at) are
// explicitly NOT here — they are set by the service layer or DB.
// responsible_agent_id is included because admins legitimately set it from
// the UI; agent-role guard for reassignment lives in the role check
// (see TD-049 / role audit).
const ALLOWED_CLIENT_FIELDS = [
  'name', 'code', 'code_suffix', 'type',
  'location_id', 'city', 'district', 'google_maps_link', 'website_url', 'address',
  'houses_count', 'floors', 'bedrooms', 'bathrooms', 'area', 'floor_number',
  'beach_distance', 'market_distance',
  'description', 'comments', 'currency',
  'price_monthly', 'price_monthly_is_from',
  'booking_deposit', 'booking_deposit_is_from',
  'save_deposit', 'save_deposit_is_from',
  'commission', 'commission_is_from',
  'owner_commission_one_time', 'owner_commission_one_time_is_percent',
  'owner_commission_monthly', 'owner_commission_monthly_is_percent',
  'electricity_price', 'water_price', 'water_price_type', 'gas_price',
  'internet_price', 'cleaning_price', 'exit_cleaning_price',
  'air_conditioners', 'internet_speed', 'pets_allowed', 'long_term_booking',
  'amenities', 'photos', 'photos_thumb', 'videos', 'video_url',
  'parent_id',
  'owner_id', 'owner_id_2',
  'responsible_agent_id',
];

function pickAllowed(updates) {
  if (!updates || typeof updates !== 'object') return {};
  const out = {};
  for (const key of ALLOWED_CLIENT_FIELDS) {
    if (key in updates) out[key] = updates[key];
  }
  return out;
}

// TD-067: количество объектов в локации. HEAD-запрос count='exact' — без выгрузки.
export async function getPropertiesCountByLocation(locationId) {
  if (!locationId) return 0;
  const { count, error } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if (error) return 0;
  return count || 0;
}

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

/** Resolve company_id for the current session user.
 *  Returns the agent's company_id if they are an active team member,
 *  otherwise returns null (owner/private flow — unchanged). */
async function resolveAgentCompanyId(userId) {
  try {
    const { data, error } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId)
      .eq('role', 'agent')
      .eq('status', 'active')
      .maybeSingle();
    if (error) {
      console.warn('resolveAgentCompanyId: query error', error.message);
      return null;
    }
    return data?.company_id ?? null;
  } catch (e) {
    console.warn('resolveAgentCompanyId: unexpected error', e.message);
    return null;
  }
}

async function resolveCompanyOwnerId(companyId) {
  if (!companyId) return null;
  try {
    const { data, error } = await supabase
      .from('companies')
      .select('owner_id')
      .eq('id', companyId)
      .maybeSingle();
    if (error) return null;
    return data?.owner_id ?? null;
  } catch {
    return null;
  }
}

async function notifyAdminPropertyCreated({ adminId, senderId, propertyId, propertyName }) {
  if (!adminId || adminId === senderId) return;
  try {
    await sendNotification({
      recipientId: adminId,
      senderId,
      type: 'property_created',
      title: 'Agent added a new property',
      body: (propertyName || '').length > 80 ? `${propertyName.slice(0, 77)}…` : (propertyName || ''),
      propertyId,
    });
  } catch (e) {
    console.warn('[properties] property_created notification failed:', e?.message);
  }
}

async function isActiveAgentMember(userId) {
  try {
    const { data, error } = await supabase
      .from('company_members')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'agent')
      .eq('status', 'active')
      .maybeSingle();
    if (error) {
      console.warn('isActiveAgentMember: query error', error.message);
      return false;
    }
    return !!data;
  } catch (e) {
    console.warn('isActiveAgentMember: unexpected error', e.message);
    return false;
  }
}

export async function createProperty({ name, code, type, location_id, owner_id, company_id }) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const effectiveCompanyId = company_id ?? await resolveAgentCompanyId(session.user.id);
  const agentMember = await isActiveAgentMember(session.user.id);

  const { data, error } = await supabase
    .from('properties')
    .insert({
      user_id: session.user.id,
      responsible_agent_id: agentMember ? session.user.id : null,
      name: name || '',
      code: code || '',
      type: type || 'house',
      location_id: location_id || null,
      owner_id: owner_id || null,
      company_id: effectiveCompanyId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const e = new Error('Property code must be unique within the company');
      e.code = 'DUPLICATE_PROPERTY_CODE';
      throw e;
    }
    throw new Error(error.message);
  }

  if (agentMember) {
    const adminId = await resolveCompanyOwnerId(effectiveCompanyId);
    await notifyAdminPropertyCreated({
      adminId,
      senderId: session.user.id,
      propertyId: data.id,
      propertyName: data.name,
    });
  }

  syncIfEnabled();
  broadcastChange('properties');
  return data;
}

/** Create a full property (e.g. house in resort) with all fields. */
export async function createPropertyFull(updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const effectiveCompanyId = updates.company_id ?? await resolveAgentCompanyId(session.user.id);
  const agentMember = await isActiveAgentMember(session.user.id);

  const row = {
    ...pickAllowed(updates),
    user_id: session.user.id,
    responsible_agent_id: updates.responsible_agent_id ?? session.user.id,
    company_id: effectiveCompanyId,
  };

  const { data, error } = await supabase
    .from('properties')
    .insert(row)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      const e = new Error('Property code must be unique within the company');
      e.code = 'DUPLICATE_PROPERTY_CODE';
      throw e;
    }
    throw new Error(error.message);
  }

  if (agentMember) {
    const adminId = await resolveCompanyOwnerId(effectiveCompanyId);
    await notifyAdminPropertyCreated({
      adminId,
      senderId: session.user.id,
      propertyId: data.id,
      propertyName: data.name,
    });
  }

  syncIfEnabled();
  broadcastChange('properties');
  return data;
}

export async function updateProperty(id, updates) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  // If the responsible agent is changing, snapshot the previous value so we
  // can decide whether to notify the new agent after the update.
  const responsibleChanging = updates && Object.prototype.hasOwnProperty.call(updates, 'responsible_agent_id');
  let oldResponsible = null;
  if (responsibleChanging) {
    const { data: prev } = await supabase
      .from('properties')
      .select('responsible_agent_id')
      .eq('id', id)
      .maybeSingle();
    oldResponsible = prev?.responsible_agent_id ?? null;
  }

  const { data, error } = await supabase
    .from('properties')
    .update(pickAllowed(updates))
    .eq('id', id)
    .select();

  if (error) {
    if (error.code === '23505') {
      const e = new Error('Property code must be unique within the company');
      e.code = 'DUPLICATE_PROPERTY_CODE';
      throw e;
    }
    throw new Error(error.message);
  }
  const saved = data?.[0] ?? null;

  // Notify the newly-assigned responsible agent (best-effort).
  if (responsibleChanging && saved) {
    try {
      const newResponsible = saved.responsible_agent_id ?? null;
      if (newResponsible && newResponsible !== session.user.id && newResponsible !== oldResponsible) {
        const propertyName = saved.name || '';
        await sendNotification({
          recipientId: newResponsible,
          senderId: session.user.id,
          type: 'property_assigned',
          title: 'New property assigned to you',
          body: propertyName.length > 80 ? `${propertyName.slice(0, 77)}…` : propertyName,
          propertyId: saved.id,
        });
      }
    } catch (e) {
      console.warn('[properties] property_assigned notification failed:', e?.message);
    }
  }

  syncIfEnabled();
  broadcastChange('properties');
  return saved;
}

export async function deleteProperty(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  // TD-053: Delete photos from Storage before CASCADE deletes records
  try {
    const { data: propPhotos } = await supabase
      .from('properties')
      .select('photos, photos_thumb')
      .eq('id', id)
      .maybeSingle();

    const { data: childPhotos } = await supabase
      .from('properties')
      .select('photos, photos_thumb')
      .eq('parent_id', id);

    const collect = (arr) => (arr || []).filter(u => u && typeof u === 'string');
    const allPhotos = [
      ...collect(propPhotos?.photos),
      ...collect(propPhotos?.photos_thumb),
      ...((childPhotos || []).flatMap(c => [...collect(c.photos), ...collect(c.photos_thumb)])),
    ];

    for (const url of allPhotos) {
      try {
        await deletePhotoFromStorage(url);
      } catch {}
    }
  } catch (e) {
    console.warn('[deleteProperty] photo cleanup failed:', e.message);
  }

  const { error } = await supabase
    .from('properties')
    .delete()
    .eq('id', id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
  broadcastChange('properties');
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
    .select('id, type, parent_id')
    .eq('user_id', session.user.id)
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
    .eq('user_id', session.user.id);

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
    .eq('parent_id', resortId)
    .eq('user_id', session.user.id);

  if (fetchErr || !children?.length) return;
  const ids = children.map((c) => c.id);
  await supabase
    .from('properties')
    .update({ district: district || null })
    .in('id', ids)
    .eq('user_id', session.user.id);
  syncIfEnabled();
}

/** Admin: назначить ответственного агента (null = Компания). Каскад на детей резорта/кондо. */
export async function updatePropertyResponsible(propertyId, responsibleAgentId, cascade = false) {
  const value = responsibleAgentId ?? null;

  // Snapshot the previous responsible agent so we can decide whether the
  // new agent needs to be notified after the update.
  const { data: prev } = await supabase
    .from('properties')
    .select('responsible_agent_id, name')
    .eq('id', propertyId)
    .maybeSingle();

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
      .eq('parent_id', propertyId);
  }

  // Notify the newly assigned agent (only when responsibility actually
  // changed and the new agent is not the caller themselves). Best-effort.
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const sender = session?.user?.id;
    const oldAgent = prev?.responsible_agent_id ?? null;
    const newAgent = value;
    if (sender && newAgent && newAgent !== sender && newAgent !== oldAgent) {
      const propertyName = data?.name || prev?.name || '';
      await sendNotification({
        recipientId: newAgent,
        senderId: sender,
        type: 'property_assigned',
        title: 'New property assigned to you',
        body: propertyName.length > 80 ? `${propertyName.slice(0, 77)}…` : propertyName,
        propertyId: data.id,
      });
    }
  } catch (e) {
    console.warn('[properties] property_assigned notification failed:', e?.message);
  }

  syncIfEnabled();
  return data;
}

