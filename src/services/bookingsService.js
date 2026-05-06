import { supabase } from './supabase';
import { cancelCommissionReminders } from './commissionRemindersService';
import { syncIfEnabled } from './dataUploadService';
import { broadcastChange } from './companyChannel';
import { sendNotification } from './notificationsService';

// Returns true if the current user is the owner (admin) of the given company.
async function isCompanyOwner(userId, companyId) {
  if (!userId || !companyId) return false;
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('id', companyId)
    .eq('owner_id', userId)
    .maybeSingle();
  return !!data;
}

// Build a short body for booking notifications. Truncated to ~80 chars to fit
// push-notification previews on mobile.
function formatBookingNotificationBody({ propertyName, propertyCode, clientName, checkIn, checkOut }) {
  const head = propertyCode ? `${propertyName} (${propertyCode})` : (propertyName || '');
  const segments = [head, clientName, [checkIn, checkOut].filter(Boolean).join('—')].filter(Boolean);
  const body = segments.join(' · ');
  return body.length > 80 ? `${body.slice(0, 77)}…` : body;
}

// Fetch property name+code and client name for the given booking row, used
// to compose readable notification bodies. Errors are swallowed — notification
// is best-effort, must not break the create/update flow.
async function loadBookingNotificationContext(row) {
  try {
    const [{ data: property }, { data: contact }] = await Promise.all([
      row.property_id
        ? supabase.from('properties').select('name, code').eq('id', row.property_id).maybeSingle()
        : Promise.resolve({ data: null }),
      row.contact_id
        ? supabase.from('contacts').select('name').eq('id', row.contact_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return {
      propertyName: property?.name || '',
      propertyCode: property?.code || '',
      clientName: contact?.name || '',
    };
  } catch {
    return { propertyName: '', propertyCode: '', clientName: '' };
  }
}

// TD-061: считает брони для объекта (включая бронирования всех его дочерних юнитов,
// если объект — контейнер resort/condo). Использует HEAD-запрос count='exact' — без выгрузки данных.
export async function getBookingsCountForProperty(propertyId) {
  if (!propertyId) return 0;
  const { data: children } = await supabase
    .from('properties')
    .select('id')
    .eq('parent_id', propertyId);
  const ids = [propertyId, ...((children || []).map(c => c.id))];
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .in('property_id', ids);
  if (error) return 0;
  return count || 0;
}

export async function getBookings(propertyId = null, contactId = null, agentId = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  let q = supabase
    .from('bookings')
    .select('*')
    .order('check_in', { ascending: false })
    .limit(10000);

  if (propertyId) {
    q = q.eq('property_id', propertyId);
  }
  if (contactId) {
    q = q.eq('contact_id', contactId);
  }

  // When fetching for a specific agent, limit to bookings in their responsible properties
  if (agentId && !propertyId) {
    const { data: props } = await supabase
      .from('properties')
      .select('id')
      .eq('responsible_agent_id', agentId);
    const propIds = (props || []).map(p => p.id);
    if (propIds.length === 0) return [];
    q = q.in('property_id', propIds);
  }

  const { data, error } = await q;

  if (error) {
    console.error('getBookings error:', error.message);
    return [];
  }

  return (data || []).map(mapBooking);
}

async function checkBookingConflict(propertyId, checkIn, checkOut, excludeId = null) {
  let q = supabase
    .from('bookings')
    .select('id, check_in, check_out')
    .eq('property_id', propertyId)
    .lt('check_in', checkOut)
    .gt('check_out', checkIn);

  if (excludeId) {
    q = q.neq('id', excludeId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).length > 0;
}

export async function createBooking(booking) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const hasConflict = await checkBookingConflict(
    booking.propertyId,
    booking.checkIn,
    booking.checkOut
  );
  if (hasConflict) throw new Error('BOOKING_CONFLICT');

  const { data: prop } = await supabase
    .from('properties')
    .select('company_id, responsible_agent_id')
    .eq('id', booking.propertyId)
    .maybeSingle();
  if (!prop?.company_id) throw new Error('BOOKING_NO_COMPANY');

  const isAdmin = await isCompanyOwner(session.user.id, prop.company_id);
  // For admin: take responsibleAgentId from payload (defaults to NULL = Company).
  // For agent: forced to self (agent always creates on themselves).
  // DB trigger trg_enforce_booking_agent_matches_property guarantees integrity.
  const requestedResponsible = booking.responsibleAgentId === undefined
    ? null
    : booking.responsibleAgentId;
  const responsibleAgentId = isAdmin
    ? (requestedResponsible || null)
    : session.user.id;

  const row = {
    user_id: session.user.id,
    booking_agent_id: responsibleAgentId,
    company_id: prop.company_id,
    property_id: booking.propertyId,
    contact_id: booking.contactId || null,
    passport_id: booking.passportId || null,
    not_my_customer: !!booking.notMyCustomer,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    check_in_time: booking.checkInTime || null,
    check_out_time: booking.checkOutTime || null,
    price_monthly: booking.priceMonthly != null ? Number(booking.priceMonthly) : null,
    total_price: booking.totalPrice != null ? Number(booking.totalPrice) : null,
    booking_deposit: booking.bookingDeposit != null ? Number(booking.bookingDeposit) : null,
    save_deposit: booking.saveDeposit != null ? Number(booking.saveDeposit) : null,
    commission: booking.commission != null ? Number(booking.commission) : null,
    owner_commission_one_time: booking.ownerCommissionOneTime != null ? Number(booking.ownerCommissionOneTime) : null,
    owner_commission_one_time_is_percent: booking.ownerCommissionOneTimeIsPercent ?? false,
    owner_commission_monthly: booking.ownerCommissionMonthly != null ? Number(booking.ownerCommissionMonthly) : null,
    owner_commission_monthly_is_percent: booking.ownerCommissionMonthlyIsPercent ?? false,
    adults: booking.adults != null ? parseInt(booking.adults, 10) : null,
    children: booking.children != null ? parseInt(booking.children, 10) : null,
    pets: !!booking.pets,
    comments: booking.comments || null,
    photos: Array.isArray(booking.photos) && booking.photos.length > 0 ? booking.photos : null,
    reminder_days: Array.isArray(booking.reminderDays) && booking.reminderDays.length > 0 ? booking.reminderDays : null,
    currency: booking.currency || 'THB',
    monthly_breakdown: Array.isArray(booking.monthlyBreakdown) ? booking.monthlyBreakdown : [],
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Notify the new responsible agent if the booking was assigned to someone
  // other than the creator. Best-effort; failure does not affect the result.
  if (data.booking_agent_id && data.booking_agent_id !== session.user.id) {
    try {
      const ctx = await loadBookingNotificationContext(data);
      await sendNotification({
        recipientId: data.booking_agent_id,
        senderId: session.user.id,
        type: 'booking_assigned',
        title: 'New booking assigned to you',
        body: formatBookingNotificationBody({
          ...ctx,
          checkIn: data.check_in,
          checkOut: data.check_out,
        }),
        propertyId: data.property_id,
        bookingId: data.id,
      });
    } catch (e) {
      console.warn('[bookings] booking_assigned notification failed:', e?.message);
    }
  }

  // If the creator is an agent, notify the company admin about the new booking.
  if (!isAdmin && prop.company_id) {
    try {
      const { data: company } = await supabase
        .from('companies')
        .select('owner_id')
        .eq('id', prop.company_id)
        .maybeSingle();
      const adminId = company?.owner_id ?? null;
      if (adminId && adminId !== session.user.id) {
        const ctx = await loadBookingNotificationContext(data);
        await sendNotification({
          recipientId: adminId,
          senderId: session.user.id,
          type: 'booking_created',
          title: 'New booking added by agent',
          body: formatBookingNotificationBody({
            ...ctx,
            checkIn: data.check_in,
            checkOut: data.check_out,
          }),
          propertyId: data.property_id,
          bookingId: data.id,
        });
      }
    } catch (e) {
      console.warn('[bookings] booking_created notification failed:', e?.message);
    }
  }

  syncIfEnabled();
  broadcastChange('bookings');
  return mapBooking(data);
}

export async function updateBooking(id, booking) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const hasConflict = await checkBookingConflict(
    booking.propertyId,
    booking.checkIn,
    booking.checkOut,
    id
  );
  if (hasConflict) throw new Error('BOOKING_CONFLICT');

  // Load old booking — needed for: (a) detecting field changes for the
  // booking_updated notification, (b) detecting property_id change to
  // auto-reset booking_agent_id, (c) deciding whether the responsible
  // agent changed.
  const { data: oldBooking } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  // Determine caller role (admin vs agent) once, used for both the
  // booking_agent_id write rules and the role-aware UPDATE filter below.
  const { data: ownedCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();
  const isAdmin = !!ownedCompany;

  const updates = {};

  if (booking.propertyId) {
    const { data: prop } = await supabase
      .from('properties')
      .select('company_id')
      .eq('id', booking.propertyId)
      .maybeSingle();
    if (prop?.company_id) updates.company_id = prop.company_id;
  }

  Object.assign(updates, {
    contact_id: booking.contactId || null,
    passport_id: booking.passportId || null,
    not_my_customer: !!booking.notMyCustomer,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    check_in_time: booking.checkInTime || null,
    check_out_time: booking.checkOutTime || null,
    price_monthly: booking.priceMonthly != null ? Number(booking.priceMonthly) : null,
    total_price: booking.totalPrice != null ? Number(booking.totalPrice) : null,
    booking_deposit: booking.bookingDeposit != null ? Number(booking.bookingDeposit) : null,
    save_deposit: booking.saveDeposit != null ? Number(booking.saveDeposit) : null,
    commission: booking.commission != null ? Number(booking.commission) : null,
    owner_commission_one_time: booking.ownerCommissionOneTime != null ? Number(booking.ownerCommissionOneTime) : null,
    owner_commission_one_time_is_percent: booking.ownerCommissionOneTimeIsPercent ?? false,
    owner_commission_monthly: booking.ownerCommissionMonthly != null ? Number(booking.ownerCommissionMonthly) : null,
    owner_commission_monthly_is_percent: booking.ownerCommissionMonthlyIsPercent ?? false,
    adults: booking.adults != null ? parseInt(booking.adults, 10) : null,
    children: booking.children != null ? parseInt(booking.children, 10) : null,
    pets: !!booking.pets,
    comments: booking.comments || null,
    photos: Array.isArray(booking.photos) && booking.photos.length > 0 ? booking.photos : null,
    reminder_days: Array.isArray(booking.reminderDays) && booking.reminderDays.length > 0 ? booking.reminderDays : [],
    currency: booking.currency || 'THB',
    monthly_breakdown: Array.isArray(booking.monthlyBreakdown) ? booking.monthlyBreakdown : [],
  });
  updates.updated_at = new Date().toISOString();

  // booking_agent_id rules:
  //  - Admin can change it via the picker. We accept whatever they sent.
  //  - Admin changing property → reset to NULL unless they explicitly chose
  //    a new responsibleAgentId for the new property.
  //  - Agent never writes this field (RLS + DB trigger would block anyway).
  const propertyChanged = booking.propertyId && oldBooking
    && booking.propertyId !== oldBooking.property_id;
  if (isAdmin) {
    if (booking.responsibleAgentId !== undefined) {
      updates.booking_agent_id = booking.responsibleAgentId || null;
    } else if (propertyChanged) {
      updates.booking_agent_id = null;
    }
  }

  let updateQ = supabase.from('bookings').update(updates).eq('id', id);
  if (isAdmin) {
    updateQ = updateQ.eq('company_id', ownedCompany.id);
  } else {
    // Agent edits bookings where they are the responsible agent — including
    // bookings the admin handed over to them (creator differs from responsible).
    updateQ = updateQ.eq('booking_agent_id', session.user.id);
  }

  const { data, error } = await updateQ.select().single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('BOOKING_UPDATE_FORBIDDEN');

  // Notifications. Best-effort — failures must not break the save.
  try {
    const oldAgent = oldBooking?.booking_agent_id ?? null;
    const newAgent = data.booking_agent_id ?? null;
    const sender = session.user.id;
    const ctx = await loadBookingNotificationContext(data);
    const body = formatBookingNotificationBody({
      ...ctx,
      checkIn: data.check_in,
      checkOut: data.check_out,
    });

    if (oldAgent !== newAgent && newAgent && newAgent !== sender) {
      // Case A: ownership transferred to a new agent.
      await sendNotification({
        recipientId: newAgent,
        senderId: sender,
        type: 'booking_assigned',
        title: 'New booking assigned to you',
        body,
        propertyId: data.property_id,
        bookingId: data.id,
      });
    } else if (oldAgent === newAgent && newAgent && newAgent !== sender) {
      // Case B: same responsible agent, but admin changed other fields.
      // Detect non-trivial change by comparing each watched field.
      const watched = [
        'property_id', 'contact_id', 'passport_id', 'not_my_customer',
        'check_in', 'check_out', 'check_in_time', 'check_out_time',
        'price_monthly', 'total_price', 'booking_deposit', 'save_deposit',
        'commission', 'owner_commission_one_time',
        'owner_commission_one_time_is_percent', 'owner_commission_monthly',
        'owner_commission_monthly_is_percent', 'adults', 'children',
        'pets', 'comments', 'currency',
      ];
      const changed = oldBooking && watched.some(k => oldBooking[k] !== data[k]);
      if (changed) {
        await sendNotification({
          recipientId: newAgent,
          senderId: sender,
          type: 'booking_updated',
          title: 'Booking updated',
          body,
          propertyId: data.property_id,
          bookingId: data.id,
        });
      }
    }
  } catch (e) {
    console.warn('[bookings] update notification failed:', e?.message);
  }

  syncIfEnabled();
  broadcastChange('bookings');
  return mapBooking(data);
}

export async function deleteBooking(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { data: ownedCompany } = await supabase
    .from('companies')
    .select('id')
    .eq('owner_id', session.user.id)
    .eq('status', 'active')
    .maybeSingle();

  await cancelCommissionReminders(id);

  let deleteQ = supabase.from('bookings').delete().eq('id', id);
  if (ownedCompany) {
    deleteQ = deleteQ.eq('company_id', ownedCompany.id);
  } else {
    // Symmetry with updateBooking: agent deletes bookings where they are the
    // responsible agent — including ones the admin handed over to them.
    deleteQ = deleteQ.eq('booking_agent_id', session.user.id);
  }

  const { data: deleted, error } = await deleteQ.select('id');

  if (error) throw new Error(error.message);
  if (!deleted || deleted.length === 0) throw new Error('BOOKING_DELETE_FORBIDDEN');
  syncIfEnabled();
  broadcastChange('bookings');
}

function mapBooking(row) {
  return {
    id: row.id,
    // agentId — legacy: creator of the booking (user_id). Kept for backward
    // compatibility; new code should use responsibleAgentId for ownership checks.
    agentId: row.user_id,
    // responsibleAgentId — current owner of the booking (booking_agent_id).
    // NULL means the booking belongs to the company (admin).
    responsibleAgentId: row.booking_agent_id ?? null,
    isCompanyBooking: row.booking_agent_id == null,
    createdAt: row.created_at,
    propertyId: row.property_id,
    contactId: row.contact_id,
    passportId: row.passport_id,
    notMyCustomer: row.not_my_customer,
    checkIn: row.check_in,
    checkOut: row.check_out,
    checkInTime: row.check_in_time || null,
    checkOutTime: row.check_out_time || null,
    priceMonthly: row.price_monthly,
    totalPrice: row.total_price,
    bookingDeposit: row.booking_deposit,
    saveDeposit: row.save_deposit,
    commission: row.commission,
    ownerCommissionOneTime: row.owner_commission_one_time,
    ownerCommissionOneTimeIsPercent: row.owner_commission_one_time_is_percent ?? false,
    ownerCommissionMonthly: row.owner_commission_monthly,
    ownerCommissionMonthlyIsPercent: row.owner_commission_monthly_is_percent ?? false,
    adults: row.adults,
    children: row.children,
    pets: row.pets,
    comments: row.comments,
    photos: Array.isArray(row.photos) ? row.photos : [],
    reminderDays: Array.isArray(row.reminder_days) ? row.reminder_days : [],
    currency: row.currency || 'THB',
    monthlyBreakdown: Array.isArray(row.monthly_breakdown) ? row.monthly_breakdown : [],
  };
}
