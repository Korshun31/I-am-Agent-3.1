import { supabase } from './supabase';

export async function getBookings(propertyId = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return [];

  let q = supabase
    .from('bookings')
    .select('*')
    .eq('agent_id', session.user.id)
    .order('check_in', { ascending: false });

  if (propertyId) {
    q = q.eq('property_id', propertyId);
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
    price_monthly: booking.priceMonthly != null ? Number(booking.priceMonthly) : null,
    total_price: booking.totalPrice != null ? Number(booking.totalPrice) : null,
    booking_deposit: booking.bookingDeposit != null ? Number(booking.bookingDeposit) : null,
    save_deposit: booking.saveDeposit != null ? Number(booking.saveDeposit) : null,
    commission: booking.commission != null ? Number(booking.commission) : null,
    adults: booking.adults != null ? parseInt(booking.adults, 10) : null,
    children: booking.children != null ? parseInt(booking.children, 10) : null,
    pets: !!booking.pets,
    comments: booking.comments || null,
    photos: Array.isArray(booking.photos) && booking.photos.length > 0 ? booking.photos : null,
  };

  const { data, error } = await supabase
    .from('bookings')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(error.message);
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
    price_monthly: booking.priceMonthly != null ? Number(booking.priceMonthly) : null,
    total_price: booking.totalPrice != null ? Number(booking.totalPrice) : null,
    booking_deposit: booking.bookingDeposit != null ? Number(booking.bookingDeposit) : null,
    save_deposit: booking.saveDeposit != null ? Number(booking.saveDeposit) : null,
    commission: booking.commission != null ? Number(booking.commission) : null,
    adults: booking.adults != null ? parseInt(booking.adults, 10) : null,
    children: booking.children != null ? parseInt(booking.children, 10) : null,
    pets: !!booking.pets,
    comments: booking.comments || null,
    photos: Array.isArray(booking.photos) && booking.photos.length > 0 ? booking.photos : null,
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
  return mapBooking(data);
}

export async function deleteBooking(id) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', id)
    .eq('agent_id', session.user.id);

  if (error) throw new Error(error.message);
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
    priceMonthly: row.price_monthly,
    totalPrice: row.total_price,
    bookingDeposit: row.booking_deposit,
    saveDeposit: row.save_deposit,
    commission: row.commission,
    adults: row.adults,
    children: row.children,
    pets: row.pets,
    comments: row.comments,
    photos: Array.isArray(row.photos) ? row.photos : [],
  };
}
