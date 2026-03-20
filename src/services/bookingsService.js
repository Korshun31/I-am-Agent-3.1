import { supabase } from './supabase';
import { cancelCommissionReminders } from './commissionRemindersService';
import { syncIfEnabled } from './dataUploadService';

export async function getBookings(propertyId = null, contactId = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  let q = supabase
    .from('bookings')
    .select('*')
    .eq('agent_id', session.user.id)
    .order('check_in', { ascending: false })
    .limit(10000);

  if (propertyId) {
    q = q.eq('property_id', propertyId);
  }
  if (contactId) {
    q = q.eq('contact_id', contactId);
  }

  const { data, error } = await q;

  if (error) {
    console.error('getBookings error:', error.message);
    return [];
  }

  return (data || []).map(mapBooking);
}

export async function createBooking(booking) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const row = {
    agent_id: session.user.id,
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
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return mapBooking(data);
}

export async function updateBooking(id, booking) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const updates = {
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
  };
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', id)
    .eq('agent_id', session.user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  syncIfEnabled();
  return mapBooking(data);
}

export async function deleteBooking(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  await cancelCommissionReminders(id);
  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
  syncIfEnabled();
}

function mapBooking(row) {
  return {
    id: row.id,
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
  };
}
