import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  Linking,
} from 'react-native';
import Constants from 'expo-constants';
import { useLanguage } from '../context/LanguageContext';
import { deleteContact } from '../services/contactsService';
import AddContactModal from '../components/AddContactModal';
import { updateContact } from '../services/contactsService';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  backArrow: '#5DB8D4',
  cardBg: '#FFFFFF',
  border: '#E0DAD2',
  contactLink: '#D81B60',
  labelColor: '#8A8A8A',
  deleteRed: '#E85D4C',
  editGreen: '#2E7D32',
  clientBadge: '#449CDA',
  ownerBadge: '#C2920E',
};

export default function ContactDetailScreen({ contact, onBack, onContactUpdated, onContactDeleted }) {
  const { t } = useLanguage();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [currentContact, setCurrentContact] = useState(contact);

  const c = currentContact;
  const displayName = [c.name, c.lastName].filter(Boolean).join(' ') || c.name || '';
  const isOwner = c.type === 'owners';
  const badgeColor = isOwner ? COLORS.ownerBadge : COLORS.clientBadge;
  const badgeLabel = isOwner ? t('contactOwner') : t('contactClient');

  const openPhone = (number) => {
    const clean = (number || '').replace(/\s/g, '');
    if (!clean) return;
    Alert.alert(number, t('callOrMessage'), [
      { text: t('back'), style: 'cancel' },
      { text: t('call'), onPress: () => Linking.openURL('tel:' + clean) },
      { text: t('sendMessage'), onPress: () => Linking.openURL('sms:' + clean) },
    ]);
  };

  const openEmail = (address) => {
    if (!address?.trim()) return;
    Linking.openURL('mailto:' + encodeURIComponent(address.trim()));
  };

  const openTelegram = (value) => {
    const v = (value || '').trim();
    if (!v) return;
    const isPhone = /^\+?[\d\s-]+$/.test(v);
    const url = isPhone
      ? 'https://t.me/+' + v.replace(/\D/g, '')
      : 'https://t.me/' + (v.startsWith('@') ? v.slice(1) : v);
    Linking.openURL(url);
  };

  const openWhatsApp = (number) => {
    const digits = (number || '').replace(/\D/g, '');
    if (!digits) return;
    Linking.openURL('https://wa.me/' + digits);
  };

  const handleDelete = () => {
    Alert.alert(t('deleteContactTitle'), t('deleteContactConfirm'), [
      { text: t('back'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContact(c.id);
            onContactDeleted?.(c.id);
            onBack();
          } catch (e) {
            Alert.alert(t('error'), e.message);
          }
        },
      },
    ]);
  };

  const handleEditSave = async (data) => {
    try {
      const updated = await updateContact(c.id, data);
      setCurrentContact(updated);
      onContactUpdated?.(updated);
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const InfoRow = ({ icon, value, onPress }) => {
    if (!value?.trim()) return null;
    return (
      <TouchableOpacity style={styles.infoRow} onPress={onPress} activeOpacity={0.7}>
        <Image source={icon} style={styles.infoIcon} resizeMode="contain" />
        <Text style={[styles.infoText, onPress && styles.infoTextLink]}>{value}</Text>
      </TouchableOpacity>
    );
  };

  const DetailRow = ({ label, value }) => {
    if (!value?.trim()) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{badgeLabel}</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          {c.photoUri ? (
            <Image source={{ uri: c.photoUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>
                {(c.name?.[0] || '').toUpperCase()}{(c.lastName?.[0] || '').toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.contactName}>{displayName}</Text>
          <View style={[styles.typeBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.typeBadgeText}>{badgeLabel}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{t('contacts')}</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.editBtn} activeOpacity={0.8}>
              <Image source={require('../../assets/pencil-icon.png')} style={styles.editIcon} resizeMode="contain" />
            </TouchableOpacity>
          </View>

          <InfoRow
            icon={require('../../assets/icon-contact-phone.png')}
            value={c.phone}
            onPress={() => openPhone(c.phone)}
          />
          {(c.extraPhones || []).map((p, i) =>
            p ? (
              <InfoRow
                key={`p-${i}`}
                icon={require('../../assets/icon-contact-phone.png')}
                value={p}
                onPress={() => openPhone(p)}
              />
            ) : null
          )}
          <InfoRow
            icon={require('../../assets/icon-contact-email.png')}
            value={c.email}
            onPress={() => openEmail(c.email)}
          />
          {(c.extraEmails || []).map((e, i) =>
            e ? (
              <InfoRow
                key={`e-${i}`}
                icon={require('../../assets/icon-contact-email.png')}
                value={e}
                onPress={() => openEmail(e)}
              />
            ) : null
          )}
          <InfoRow
            icon={require('../../assets/icon-contact-telegram.png')}
            value={c.telegram}
            onPress={() => openTelegram(c.telegram)}
          />
          <InfoRow
            icon={require('../../assets/icon-contact-whatsapp.png')}
            value={c.whatsapp}
            onPress={() => openWhatsApp(c.whatsapp)}
          />
        </View>

        {(c.documentNumber || c.nationality || c.birthday) ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('myDetails')}</Text>
            <DetailRow label={t('numberIdPassport')} value={c.documentNumber} />
            <DetailRow label={t('nationality')} value={c.nationality} />
            <DetailRow label={t('birthdayDate')} value={c.birthday} />
          </View>
        ) : null}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
          <Text style={styles.deleteBtnText}>{t('deleteContactTitle')}</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <AddContactModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        contactType={c.type}
        editContact={c}
        onSave={handleEditSave}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  fixedTop: {
    paddingTop: TOP_INSET,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 52,
    padding: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backArrowText: {
    fontSize: 24,
    color: COLORS.backArrow,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
    textAlign: 'center',
  },
  headerRight: {
    width: 52,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 88,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0D8CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 12,
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8A8A8A',
  },
  contactName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.title,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.title,
  },
  editBtn: {
    padding: 6,
  },
  editIcon: {
    width: 22,
    height: 22,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    width: 22,
    height: 22,
    marginRight: 10,
  },
  infoText: {
    fontSize: 15,
    color: COLORS.title,
  },
  infoTextLink: {
    fontWeight: '700',
    color: COLORS.contactLink,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: COLORS.labelColor,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.title,
  },
  deleteBtn: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(232, 93, 76, 0.4)',
    backgroundColor: 'rgba(232, 93, 76, 0.06)',
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.deleteRed,
  },
  bottomSpacer: {
    height: 20,
  },
});
