import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { IconCall, IconWhatsapp, IconTelegram } from './ContactIcons';

const ACCENT = '#3D7D82';
const ICON_COLOR = '#888';

function digitsOnly(s) {
  return String(s || '').replace(/[^\d]/g, '');
}

export function openTelegram(handle) {
  const raw = String(handle || '').trim();
  if (!raw) return;
  if (raw.startsWith('@')) {
    Linking.openURL(`https://t.me/${raw.slice(1)}`);
  } else if (/^\+?\d+$/.test(raw)) {
    Linking.openURL(`https://t.me/+${digitsOnly(raw)}`);
  } else {
    Linking.openURL(`https://t.me/${raw}`);
  }
}

export function openWhatsapp(phone) {
  const d = digitsOnly(phone);
  if (!d) return;
  Linking.openURL(`https://wa.me/${d}`);
}

export function openPhone(phone, t) {
  const raw = String(phone || '').trim();
  const clean = raw.replace(/\s/g, '');
  if (!clean) return;
  Alert.alert(
    raw,
    t('callOrMessage'),
    [
      { text: t('cancel'), style: 'cancel' },
      { text: t('call'), onPress: () => Linking.openURL('tel:' + clean) },
      { text: t('sendMessage'), onPress: () => Linking.openURL('sms:' + clean) },
    ],
    { cancelable: true },
  );
}

function ContactActionBtn({ children, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.contactActionBtn}>
      {children}
    </TouchableOpacity>
  );
}

export default function OwnerInfoRow({ label, name, phone, whatsapp, telegram, isLink, onPressName, t, alignRight }) {
  const hasContacts = !!(phone || whatsapp || telegram);
  const valueStyle = alignRight ? [styles.value, { textAlign: 'right' }] : styles.value;
  const actionsStyle = alignRight ? [styles.actions, { marginLeft: 'auto' }] : styles.actions;
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={1}>{label}</Text>
        <View style={styles.valueWrap}>
          {isLink ? (
            <TouchableOpacity onPress={onPressName}>
              <Text style={[valueStyle, styles.link]} numberOfLines={1}>{name || '—'}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={valueStyle} numberOfLines={1}>{name || '—'}</Text>
          )}
        </View>
      </View>
      {hasContacts ? (
        <View style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>{t('pdContacts')}</Text>
          <View style={actionsStyle}>
            {phone ? (
              <ContactActionBtn onPress={() => openPhone(phone, t)}>
                <IconCall size={22} color={ICON_COLOR} />
              </ContactActionBtn>
            ) : null}
            {whatsapp ? (
              <ContactActionBtn onPress={() => openWhatsapp(whatsapp)}>
                <IconWhatsapp size={22} color={ICON_COLOR} />
              </ContactActionBtn>
            ) : null}
            {telegram ? (
              <ContactActionBtn onPress={() => openTelegram(telegram)}>
                <IconTelegram size={22} color={ICON_COLOR} />
              </ContactActionBtn>
            ) : null}
          </View>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: '#6B6B6B',
    width: 130,
    flexShrink: 0,
  },
  valueWrap: {
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  link: {
    color: ACCENT,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
