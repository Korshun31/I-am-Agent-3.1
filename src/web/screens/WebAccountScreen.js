import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Platform, Linking, Switch,
  TextInput,
} from 'react-native';
import { getCurrentUser, updateUserProfile, signOut, canChangePassword } from '../../services/authService';
import { activateCompany, deactivateCompany, updateCompany } from '../../services/companyService';
import { getLocations } from '../../services/locationsService';
import { useLanguage } from '../../context/LanguageContext';
import WebMyDetailsEditModal from '../components/WebMyDetailsEditModal';
import WebLocationsModal from '../components/WebLocationsModal';
import WebSettingsModal from '../components/WebSettingsModal';
import WebTeamSection from '../components/WebTeamSection';

const ACCENT = '#3D7D82';
const C = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E9ECEF',
  text: '#212529',
  muted: '#6C757D',
  light: '#ADB5BD',
  accent: ACCENT,
  accentBg: '#EAF4F5',
  danger: '#E53935',
  dangerBg: '#FFF5F5',
};

function SectionCard({ title, children, action }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>{title}</Text>
        {action}
      </View>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

function InfoRow({ label, value, isLink, onPress }) {
  if (!value && !isLink) return null;
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      {isLink ? (
        <TouchableOpacity onPress={onPress}>
          <Text style={[s.infoValue, s.linkText]}>{value || '—'}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={s.infoValue}>{value || '—'}</Text>
      )}
    </View>
  );
}

export default function WebAccountScreen({ user: initialUser, onLogout, onUserUpdate }) {
  const { t, setLanguage } = useLanguage();
  const [user, setUser] = useState(initialUser);

  // Sync internal state if prop changes
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const updateAndSync = (updated) => {
    if (!updated) return;
    setUser(updated);
    onUserUpdate?.(updated);
  };

  const toggleWebNotif = async (key, val) => {
    // 1. Оптимистично обновляем локальное состояние (мгновенно для пользователя)
    const currentNotifs = user?.web_notifications || {
      new_booking: false,
      booking_changed: false,
      new_event: false,
      new_property: false
    };
    const newNotifs = { ...currentNotifs, [key]: val };
    
    const optimisticUser = { ...user, web_notifications: newNotifs };
    setUser(optimisticUser);
    onUserUpdate?.(optimisticUser);

    try {
      // 2. Отправляем запрос в базу в фоне
      const updated = await updateUserProfile({
        web_notifications: newNotifs
      });
      // 3. Если пришел ответ, синхронизируем (на случай если база что-то изменила)
      if (updated) updateAndSync(updated);
    } catch (e) {
      console.error('Toggle web notif error:', e);
      // Если ошибка — возвращаем как было
      setUser(user);
      onUserUpdate?.(user);
      alert(t('errorSaveSettings'));
    }
  };
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [allowChangePassword, setAllowChangePassword] = useState(false);
  const [editDetailsVisible, setEditDetailsVisible] = useState(false);
  const [locationsVisible, setLocationsVisible] = useState(false);
  const [settingsModal, setSettingsModal] = useState({ visible: false, type: '' });
  const [editingCompany, setEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({ name: '', phone: '', email: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, locs, canChange] = await Promise.all([
        getCurrentUser(),
        getLocations(),
        canChangePassword(),
      ]);
      if (profile) setUser(profile);
      setLocations(locs);
      setAllowChangePassword(canChange);
    } catch (e) {
      console.error('Account load error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleLogout = async () => {
    try {
      await signOut();
      onLogout?.();
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const startEditCompany = () => {
    setCompanyForm({
      name: user?.companyInfo?.name || '',
      phone: user?.companyInfo?.phone || '',
      email: user?.companyInfo?.email || '',
    });
    setEditingCompany(true);
  };

  const saveCompany = async () => {
    try {
      if (user?.companyId) {
        await updateCompany(user.companyId, companyForm);
      } else {
        await activateCompany(companyForm);
      }
      const updated = await getCurrentUser();
      updateAndSync(updated);
      setEditingCompany(false);
    } catch (e) {
      console.error('Save company error:', e);
      alert(t('errorSaveCompany'));
    }
  };

  const handleSwitchToCompany = async () => {
    if (!['premium', 'admin'].includes(user?.role)) {
      alert(t('premiumRequiredAlert'));
      return;
    }
    try {
      await activateCompany(user?.companyInfo || {});
      const updated = await getCurrentUser();
      updateAndSync(updated);
    } catch (e) {
      console.error('Switch to company error:', e);
    }
  };

  const handleSwitchToPrivate = async () => {
    try {
      await deactivateCompany();
      const updated = await getCurrentUser();
      updateAndSync(updated);
    } catch (e) {
      if (e?.message === 'HAS_ACTIVE_MEMBERS') {
        alert(t('errorActiveAgents'));
      } else {
        console.error('Switch to private error:', e);
      }
    }
  };

  if (loading && !user) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={s.centered}>
        <Text style={s.emptyText}>{t('userNotFound')}</Text>
      </View>
    );
  }

  const displayName = [user?.name, user?.lastName].filter(Boolean).join(' ') || user?.email;

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <View style={s.header}>
        <View style={s.profileInfo}>
          <View style={s.avatarWrap}>
            {user?.photoUri ? (
              <Image source={{ uri: user.photoUri }} style={s.avatar} />
            ) : (
              <View style={s.avatarPlaceholder}>
                <Text style={s.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
              </View>
            )}
          </View>
          <View>
            <Text style={s.userName}>{displayName}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{user?.role?.toUpperCase() || 'STANDARD'}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutBtnText}>{t('logout')}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.grid}>
        {/* Левая колонка */}
        <View style={s.column}>
          <SectionCard 
            title={t('myDetails')} 
            action={
              <TouchableOpacity style={s.editActionBtn} onPress={() => setEditDetailsVisible(true)}>
                <Text style={s.editActionText}>{t('editContact')}</Text>
              </TouchableOpacity>
            }
          >
            <InfoRow label="Email" value={user?.email} />
            <InfoRow label={t('phone')} value={user?.phone} isLink onPress={() => Linking.openURL(`tel:${user?.phone}`)} />
            <InfoRow label={t('telegram')} value={user?.telegram} isLink onPress={() => Linking.openURL(`https://t.me/${user?.telegram?.replace('@', '')}`)} />
            <InfoRow label={t('whatsapp')} value={user?.whatsapp} isLink onPress={() => Linking.openURL(`https://wa.me/${user?.whatsapp?.replace(/\D/g, '')}`)} />
            <InfoRow label={t('documentNumber')} value={user?.documentNumber} />
          </SectionCard>

          <SectionCard 
            title={t('myCompany')}
            action={
              user?.workAs === 'company' && !editingCompany && (
                <TouchableOpacity style={s.editActionBtn} onPress={startEditCompany}>
                  <Text style={s.editActionText}>{t('editContact')}</Text>
                </TouchableOpacity>
              )
            }
          >
            <View style={s.workAsRow}>
              <Text style={s.workAsLabel}>{t('workAs')}</Text>
              {user?.teamMembership ? (
                <View style={s.teamMemberBadge}>
                  <Text style={s.teamMemberBadgeText}>
                    👥 {t('memberOfTeam') || 'Участник команды'}: {user.teamMembership.companyName}
                  </Text>
                </View>
              ) : (
                <View style={s.workAsToggle}>
                  <TouchableOpacity 
                    style={[s.workAsBtn, user?.workAs !== 'company' && s.workAsBtnActive]}
                    onPress={handleSwitchToPrivate}
                  >
                    <Text style={[s.workAsBtnText, user?.workAs !== 'company' && s.workAsBtnTextActive]}>{t('workAsPrivate')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[s.workAsBtn, user?.workAs === 'company' && s.workAsBtnActive]}
                    onPress={handleSwitchToCompany}
                  >
                    <Text style={[s.workAsBtnText, user?.workAs === 'company' && s.workAsBtnTextActive]}>{t('workAsCompany')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            {user?.workAs === 'company' && (
              <View style={s.companyFields}>
                {editingCompany ? (
                  <View style={s.editCompanyForm}>
                    <View style={s.editField}>
                      <Text style={s.editLabel}>{t('companyName')}</Text>
                      <TextInput
                        style={s.editInput}
                        value={companyForm.name}
                        onChangeText={v => setCompanyForm(f => ({ ...f, name: v }))}
                        placeholder="My Agency"
                      />
                    </View>
                    <View style={s.editField}>
                      <Text style={s.editLabel}>{t('companyPhone')}</Text>
                      <TextInput
                        style={s.editInput}
                        value={companyForm.phone}
                        onChangeText={v => setCompanyForm(f => ({ ...f, phone: v }))}
                        placeholder="+7..."
                      />
                    </View>
                    <View style={s.editField}>
                      <Text style={s.editLabel}>{t('companyEmail')}</Text>
                      <TextInput
                        style={s.editInput}
                        value={companyForm.email}
                        onChangeText={v => setCompanyForm(f => ({ ...f, email: v }))}
                        placeholder="agency@example.com"
                      />
                    </View>
                    <View style={s.editActions}>
                      <TouchableOpacity style={s.cancelSmallBtn} onPress={() => setEditingCompany(false)}>
                        <Text style={s.cancelSmallText}>{t('cancel')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.saveSmallBtn} onPress={saveCompany}>
                        <Text style={s.saveSmallText}>{t('save')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <>
                    <InfoRow label={t('companyName')} value={user?.companyInfo?.name} />
                    <InfoRow label={t('companyPhone')} value={user?.companyInfo?.phone} />
                    <InfoRow label={t('companyEmail')} value={user?.companyInfo?.email} />
                  </>
                )}
              </View>
            )}
            {user?.workAs === 'company' && user?.companyId && (
              <View style={s.teamWrap}>
                <View style={s.teamDivider} />
                <WebTeamSection companyId={user.companyId} currentUserId={user.id} />
              </View>
            )}
          </SectionCard>
        </View>

        {/* Правая колонка */}
        <View style={s.column}>
          <SectionCard title={t('locations')}>
            {locations.length === 0 ? (
              <Text style={s.emptyText}>Локации не добавлены</Text>
            ) : (
              locations.map(loc => (
                <View key={loc.id} style={s.locationItem}>
                  <Text style={s.locationName}>{loc.displayName}</Text>
                </View>
              ))
            )}
            <TouchableOpacity style={s.addLocationBtn} onPress={() => setLocationsVisible(true)}>
              <Text style={s.addLocationText}>{t('locationsAddRemove')}</Text>
            </TouchableOpacity>
          </SectionCard>

          <SectionCard title={t('settings')}>
            <TouchableOpacity 
              style={s.settingRow} 
              onPress={() => setSettingsModal({ visible: true, type: 'language' })}
            >
              <Text style={s.settingLabel}>{t('language')}</Text>
              <Text style={[s.settingValue, { color: ACCENT }]}>
                {user?.language === 'ru' ? t('langNameRu') : user?.language === 'th' ? t('langNameTh') : t('langNameEn')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={s.settingRow} 
              onPress={() => setSettingsModal({ visible: true, type: 'currency' })}
            >
              <Text style={s.settingLabel}>{t('currencySelection')}</Text>
              <Text style={[s.settingValue, { color: ACCENT }]}>
                {user?.selectedCurrency || 'THB'}
              </Text>
            </TouchableOpacity>
          </SectionCard>

          <SectionCard title={t('notifWebTitle')}>
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t('notifNewBooking')}</Text>
              <Switch 
                value={!!user?.web_notifications?.new_booking} 
                onValueChange={(v) => toggleWebNotif('new_booking', v)}
                trackColor={{ false: C.border, true: ACCENT }}
              />
            </View>
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t('notifBookingChanged')}</Text>
              <Switch 
                value={!!user?.web_notifications?.booking_changed} 
                onValueChange={(v) => toggleWebNotif('booking_changed', v)}
                trackColor={{ false: C.border, true: ACCENT }}
              />
            </View>
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t('notifNewEvent')}</Text>
              <Switch 
                value={!!user?.web_notifications?.new_event} 
                onValueChange={(v) => toggleWebNotif('new_event', v)}
                trackColor={{ false: C.border, true: ACCENT }}
              />
            </View>
            <View style={s.settingRow}>
              <Text style={s.settingLabel}>{t('notifNewProperty')}</Text>
              <Switch 
                value={!!user?.web_notifications?.new_property} 
                onValueChange={(v) => toggleWebNotif('new_property', v)}
                trackColor={{ false: C.border, true: ACCENT }}
              />
            </View>
          </SectionCard>

          <SectionCard title={t('statistics')}>
            <View style={s.planRow}>
              <View style={s.planInfo}>
                <Text style={s.planLabel}>{t('currentPlan') || 'Текущий план'}</Text>
                <Text style={s.planName}>{user?.role === 'admin' ? t('admin') || 'Администратор' : 'Premium'}</Text>
              </View>
              <View style={s.planBadge}>
                <Text style={s.planBadgeText}>{t('active') || 'АКТИВЕН'}</Text>
              </View>
            </View>
            {!user?.teamMembership && (
              <View style={s.crmFeature}>
                <Text style={s.crmFeatureTitle}>{t('dataExport') || 'Экспорт данных'}</Text>
                <TouchableOpacity style={s.exportBtn}>
                  <Text style={s.exportBtnText}>{t('exportToExcel') || 'Выгрузить базу в Excel'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

          <SectionCard title={t('security') || 'Безопасность'}>
            {allowChangePassword && (
              <TouchableOpacity style={s.securityBtn}>
                <Text style={s.securityBtnText}>{t('changePassword')}</Text>
              </TouchableOpacity>
            ) || null}
            <TouchableOpacity style={[s.securityBtn, s.dangerBtn]}>
              <Text style={[s.securityBtnText, s.dangerText]}>{t('deleteAccount') || 'Удалить аккаунт'}</Text>
            </TouchableOpacity>
          </SectionCard>
        </View>
      </View>
      <WebMyDetailsEditModal
        visible={editDetailsVisible}
        user={user}
        onClose={() => setEditDetailsVisible(false)}
        onSaved={setUser}
      />
      <WebLocationsModal
        visible={locationsVisible}
        onClose={() => setLocationsVisible(false)}
        onSaved={loadData}
      />
      <WebSettingsModal
        visible={settingsModal.visible}
        type={settingsModal.type}
        user={user}
        onClose={() => setSettingsModal(prev => ({ ...prev, visible: false }))}
        onSaved={setUser}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { padding: 32, maxWidth: 1200, alignSelf: 'center', width: '100%' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: 32,
    backgroundColor: C.surface,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0D8CC',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  userName: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 4 },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: ACCENT + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  roleText: { fontSize: 11, fontWeight: '800', color: ACCENT, letterSpacing: 0.5 },
  
  logoutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFCDD2',
    backgroundColor: '#FFF5F5',
  },
  logoutBtnText: { color: '#E53935', fontWeight: '700', fontSize: 14 },

  grid: { flexDirection: 'row', gap: 24 },
  column: { flex: 1, gap: 24 },

  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: '#FAFBFC',
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBody: { padding: 20 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  infoLabel: { fontSize: 14, color: C.muted },
  infoValue: { fontSize: 14, fontWeight: '600', color: C.text },
  linkText: { color: ACCENT },

  editActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#EAF4F5',
    borderWidth: 1,
    borderColor: '#B2D8DB',
  },
  editActionText: { fontSize: 12, fontWeight: '700', color: ACCENT },

  workAsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  workAsLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  workAsToggle: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  workAsBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  workAsBtnActive: {
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  workAsBtnText: { fontSize: 12, color: C.muted, fontWeight: '500' },
  workAsBtnTextActive: { color: ACCENT, fontWeight: '700' },
  companyFields: { marginTop: 8, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8 },
  teamWrap: { marginTop: 8 },
  teamDivider: { height: 1, backgroundColor: C.border, marginBottom: 16 },
  teamMemberBadge: { backgroundColor: ACCENT + '15', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  teamMemberBadgeText: { fontSize: 13, fontWeight: '600', color: ACCENT },

  locationItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: C.bg,
    borderRadius: 12,
    marginBottom: 8,
  },
  locationName: { fontSize: 14, fontWeight: '600', color: C.text },
  addLocationBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  addLocationText: { fontSize: 13, fontWeight: '600', color: C.muted },

  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  settingLabel: { fontSize: 14, color: C.text, fontWeight: '500' },
  settingValue: { fontSize: 14, color: C.muted, fontWeight: '600' },

  securityBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
    marginBottom: 10,
  },
  securityBtnText: { fontSize: 14, fontWeight: '700', color: C.text },
  dangerBtn: { borderColor: '#FFCDD2', backgroundColor: '#FFF5F5' },
  dangerText: { color: '#E53935' },
  emptyText: { textAlign: 'center', color: C.light, paddingVertical: 20, fontStyle: 'italic' },

  // Plan & CRM styles
  planRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    backgroundColor: '#F0FAF5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  planLabel: { fontSize: 12, color: '#4A7D62', fontWeight: '600', marginBottom: 2 },
  planName: { fontSize: 18, fontWeight: '800', color: '#1B5E20' },
  planBadge: { backgroundColor: '#16A34A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  planBadgeText: { fontSize: 10, fontWeight: '900', color: '#FFF' },
  
  crmFeature: { marginTop: 16 },
  crmFeatureTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 },
  integrationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
    backgroundColor: '#EAF4F5',
  },
  integrationIcon: { width: 20, height: 20 },
  integrationText: { fontSize: 14, fontWeight: '600', color: '#3D7D82' },
  
  exportBtn: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: 'center',
  },
  exportBtnText: { fontSize: 14, fontWeight: '600', color: C.muted },

  // Edit forms
  editCompanyForm: { marginTop: 12, gap: 12 },
  editField: { gap: 6 },
  editLabel: { fontSize: 12, fontWeight: '600', color: C.muted },
  editInput: {
    height: 40,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: C.text,
    backgroundColor: C.bg,
    outlineWidth: 0,
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelSmallBtn: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  cancelSmallText: { fontSize: 13, fontWeight: '600', color: C.muted },
  saveSmallBtn: { flex: 1, height: 36, borderRadius: 10, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  saveSmallText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
});
