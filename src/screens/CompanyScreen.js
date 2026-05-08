import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert, TextInput, ActivityIndicator, Modal } from 'react-native';
import Constants from 'expo-constants';
import dayjs from 'dayjs';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { useAppData } from '../context/AppDataContext';
import {
  activateCompany,
  deactivateCompany,
  updateCompany,
  getTeamData,
  createInvitation,
  resendInvitation,
  revokeInvitation,
  updateMemberPermissions,
  getAgentLocationAccess,
  setAgentLocationAccess,
  deactivateMember,
} from '../services/companyService';
import { getCompanyLocations } from '../services/locationsService';
import { getCurrentUser } from '../services/authService';
import CompanyEditModal from '../components/CompanyEditModal';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;
const ACCENT = '#3D7D82';

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  backArrow: '#5DB8D4',
  accent: ACCENT,
  fieldLabel: '#5A5A5A',
  fieldValue: '#2C2C2C',
};

const C = {
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#E9ECEF',
  text: '#212529',
  muted: '#6C757D',
  accent: ACCENT,
  accentBg: '#EAF4F5',
  danger: '#E53935',
  dangerBg: '#FFF5F5',
  success: '#16A34A',
  successBg: '#F0FAF5',
};

function PermissionToggleRow({ label, hint, value, onToggle }) {
  return (
    <View style={s.permissionRow}>
      <View style={s.permissionInfo}>
        <Text style={s.permissionLabel}>{label}</Text>
        {!!hint && <Text style={s.permissionHint}>{hint}</Text>}
      </View>
      <TouchableOpacity style={[s.toggle, value && s.toggleOn]} onPress={onToggle} activeOpacity={0.8}>
        <View style={[s.toggleThumb, value && s.toggleThumbOn]} />
      </TouchableOpacity>
    </View>
  );
}

function MemberPermissionsModal({ member, companyId, visible, onClose, onSave }) {
  const { t } = useLanguage();
  const [permissions, setPermissions] = useState(member?.permissions || {});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [locations, setLocations] = useState([]);
  const [assignedLocationIds, setAssignedLocationIds] = useState([]);

  useEffect(() => {
    if (!member) return;
    setPermissions(member.permissions || {});
    setSaveError('');
    getCompanyLocations(companyId).then(setLocations).catch(() => setLocations([]));
    getAgentLocationAccess(member.user_id, companyId)
      .then(setAssignedLocationIds)
      .catch(() => setAssignedLocationIds([]));
  }, [member?.user_id, companyId]);

  const toggle = (key) => setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleLocation = (locationId) => {
    setAssignedLocationIds((prev) =>
      prev.includes(locationId)
        ? prev.filter((id) => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave(member.member_id, permissions);
      await setAgentLocationAccess(member.user_id, companyId, assignedLocationIds);
      onClose();
    } catch (e) {
      setSaveError(t('errorSaveSettings'));
    } finally {
      setSaving(false);
    }
  };

  if (!member) return null;

  const displayName = [member.name, member.last_name].filter(Boolean).join(' ') || member.email;
  const initials = ((member.name || '')[0] || (member.email || '')[0] || '?').toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={s.modalBoxWrap}>
          <View style={s.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <View style={s.modalHeader}>
                <View style={s.modalAvatar}>
                  <Text style={s.modalAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.modalTitle}>{displayName}</Text>
                  <Text style={s.modalSubtitle}>{member.email}</Text>
                </View>
                <TouchableOpacity style={s.modalCloseBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.modalCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalSectionTitle}>{t('permSectionProperties')}</Text>
                <PermissionToggleRow
                  label={t('permCanManageProperty')}
                  hint={t('permCanManagePropertyHint')}
                  value={!!permissions.can_manage_property}
                  onToggle={() => toggle('can_manage_property')}
                />
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalSectionTitle}>{t('permSectionBookings')}</Text>
                <PermissionToggleRow
                  label={t('permCanManageBookings')}
                  hint={t('permCanManageBookingsHint')}
                  value={!!permissions.can_manage_bookings}
                  onToggle={() => toggle('can_manage_bookings')}
                />
              </View>

              <View style={s.modalSection}>
                <Text style={s.modalSectionTitle}>{t('permSectionLocations')}</Text>
                {locations.length === 0 ? (
                  <Text style={s.locationHint}>{t('permLocationsEmpty')}</Text>
                ) : (
                  <>
                    <Text style={s.locationHint}>{t('permLocationsHint')}</Text>
                    {locations.map((loc) => {
                      const checked = assignedLocationIds.includes(loc.id);
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          style={s.locationRow}
                          onPress={() => toggleLocation(loc.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[s.locationCheckbox, checked && s.locationCheckboxChecked]}>
                            {checked && <Text style={s.locationCheckmark}>✓</Text>}
                          </View>
                          <Text style={s.locationName}>{loc.displayName}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </>
                )}
              </View>

              {!!saveError && (
                <View style={s.saveErrorWrap}>
                  <Text style={s.saveErrorText}>{saveError}</Text>
                </View>
              )}

              <View style={s.modalActions}>
                <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
                  <Text style={s.modalCancelText}>{t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modalSaveBtn, saving && s.btnDisabled]} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.modalSaveText}>{t('save')}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const PERM_TAGS = [
  { key: 'can_manage_property', labelKey: 'permTagProperty' },
  { key: 'can_manage_bookings', labelKey: 'permTagBookings' },
];

function MemberRow({ member, isCurrentUser, onPress, onDeactivate }) {
  const { t } = useLanguage();
  const initials = ((member.name || '')[0] || (member.email || '')[0] || '?').toUpperCase();
  const displayName = [member.name, member.last_name].filter(Boolean).join(' ') || member.email;
  const roleLabel = member.role === 'admin' ? t('roleOwner') : t('roleAgent');

  return (
    <TouchableOpacity
      style={s.memberRow}
      onPress={member.role !== 'admin' ? onPress : undefined}
      activeOpacity={member.role !== 'admin' ? 0.7 : 1}
    >
      <View style={s.memberAvatar}>
        <Text style={s.memberAvatarText}>{initials}</Text>
      </View>
      <View style={s.memberInfo}>
        <Text style={s.memberName}>
          {displayName}{isCurrentUser ? ` (${t('you')})` : ''}
        </Text>
        <Text style={s.memberEmail}>{member.email}</Text>
        {member.role !== 'admin' && (
          <View style={s.permTagsRow}>
            {PERM_TAGS.map(({ key, labelKey }) => {
              const active = !!member.permissions?.[key];
              return (
                <View key={key} style={[s.permTag, active && s.permTagActive]}>
                  <Text style={[s.permTagText, active && s.permTagTextActive]}>
                    {active ? '✓' : '—'} {t(labelKey)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
      <View style={s.memberMeta}>
        <View style={[s.roleBadge, member.role === 'admin' && s.roleBadgeOwner]}>
          <Text style={[s.roleBadgeText, member.role === 'admin' && s.roleBadgeTextOwner]}>
            {roleLabel}
          </Text>
        </View>
        <Text style={s.memberDate}>{dayjs(member.joined_at).format('DD MMM YYYY')}</Text>
        {member.role !== 'admin' && <Text style={s.memberEditHint}>⚙️</Text>}
        {onDeactivate && (
          <TouchableOpacity
            style={s.dismissBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            onPress={onDeactivate}
          >
            <Text style={s.dismissBtnText}>{t('dismiss')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function InvitationRow({ invitation, onRevoke, onResend }) {
  const { t } = useLanguage();
  const [resending, setResending] = useState(false);

  const isExpired = invitation.status !== 'accepted'
    && invitation.expires_at
    && dayjs(invitation.expires_at).isBefore(dayjs());

  const statusLabel = isExpired
    ? t('inviteStatusExpired')
    : invitation.status === 'sent'
      ? t('inviteStatusSent')
      : invitation.status === 'revoked'
        ? t('inviteStatusRevoked')
        : t('inviteStatusPending');

  return (
    <View style={[s.invitationRow, isExpired && s.invitationRowExpired]}>
      <View style={s.invitationMain}>
        <View style={s.invitationInfo}>
          <Text style={s.invitationEmail}>{invitation.email}</Text>
          <View style={[
            s.statusBadge,
            invitation.status === 'pending' && s.statusBadgePending,
            isExpired && s.statusBadgeExpired,
          ]}>
            <Text style={s.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>
        <View style={s.invitationActions}>
          {(isExpired || invitation.status === 'revoked') && (
            <TouchableOpacity
              style={s.resendBtn}
              disabled={resending}
              onPress={async () => {
                setResending(true);
                try {
                  await onResend?.(invitation.email);
                } finally {
                  setResending(false);
                }
              }}
            >
              <Text style={s.resendBtnText}>{resending ? '...' : t('inviteResend')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.revokeBtn} onPress={() => onRevoke(invitation.id)}>
            <Text style={s.revokeBtnText}>{t('inviteRevoke')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function ConfirmModal({ visible, title, message, confirmLabel, onConfirm, onCancel, loading, error }) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel} statusBarTranslucent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={loading ? undefined : onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={s.confirmBoxWrap}>
          <View style={s.confirmBox}>
            <Text style={s.confirmTitle}>{title}</Text>
            <Text style={s.confirmMessage}>{message}</Text>
            {!!error && <Text style={s.confirmErrorText}>{error}</Text>}
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={onCancel} disabled={loading}>
                <Text style={s.confirmCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.confirmDangerBtn, loading && s.btnDisabled]}
                onPress={onConfirm}
                disabled={loading}
              >
                {loading ? <ActivityIndicator size="small" color="#E53935" /> : <Text style={s.confirmDangerBtnText}>{confirmLabel}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function CompanyScreen({ onBack, onUserUpdate }) {
  const { user = {} } = useUser();
  const { t } = useLanguage();
  const { teamSnapshotVersion } = useAppData();
  const [editModalVisible, setEditModalVisible] = useState(false);

  const companyInfo = user?.companyInfo || {};
  const companyId = user?.companyId;
  const currentUserId = user?.id;
  const isCompany = user.workAs === 'company';

  const [loadingTeam, setLoadingTeam] = useState(false);
  const [members, setMembers] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteToast, setInviteToast] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [revokeError, setRevokeError] = useState('');
  const [deactivateError, setDeactivateError] = useState('');

  const loadTeam = useCallback(async () => {
    if (!companyId || !isCompany) return;
    setLoadingTeam(true);
    try {
      const data = await getTeamData(companyId);
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch (e) {
      // оставляем пустые списки, ошибку показывать необязательно — пустой стейт говорит сам
    } finally {
      setLoadingTeam(false);
    }
  }, [companyId, isCompany]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam, teamSnapshotVersion]);

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError('');
    try {
      const result = await createInvitation(companyId, email);
      setInviteToast({ email: result.email, resent: false });
      setShowInviteForm(false);
      setInviteEmail('');
      await loadTeam();
    } catch (e) {
      const code = e?.code || '';
      if (code === 'EMAIL_OCCUPIED' || code === 'EMAIL_OCCUPIED_ORPHAN' || e?.message === 'EMAIL_EXISTS') {
        setInviteError(t('inviteEmailExists'));
      } else if (code === 'EMAIL_OCCUPIED_ORPHAN_PENDING') {
        setInviteError(t('inviteEmailOrphanPending'));
      } else if (code === 'EMAIL_RACE') {
        setInviteError(t('inviteEmailRace'));
      } else if (code === 'RATE_LIMITED') {
        setInviteError(t('inviteRateLimited'));
      } else if (code === 'COMPANY_NOT_ACTIVATED') {
        setInviteError(t('inviteCompanyNotActivated'));
      } else {
        setInviteError(t('inviteError'));
      }
    } finally {
      setInviting(false);
    }
  };

  const handleResend = async (email) => {
    try {
      const result = await resendInvitation(email);
      setInviteToast({ email: result.email, resent: true });
      await loadTeam();
    } catch (e) {
      // тихо — кнопка вернёт в активное состояние, юзер увидит что приглашение не обновилось
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError('');
    try {
      await revokeInvitation(revokeTarget);
      setRevokeTarget(null);
      setInviteToast(null);
      await loadTeam();
    } catch (e) {
      setRevokeError(t('inviteError'));
    } finally {
      setRevoking(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setDeactivateError('');
    try {
      await deactivateMember(companyId, deactivateTarget);
      setDeactivateTarget(null);
      await loadTeam();
    } catch (e) {
      setDeactivateError(t('errorSaveSettings'));
    } finally {
      setDeactivating(false);
    }
  };

  const activeMembers = members.filter((m) => m.status !== 'inactive');
  const archivedMembers = members.filter((m) => m.status === 'inactive');

  const handleSwitchToCompany = async () => {
    try {
      await activateCompany({});
      const profile = await getCurrentUser();
      onUserUpdate?.(profile);
      const ci = profile?.companyInfo || profile?.settings?.companyInfo || {};
      if (!ci.name || !ci.name.trim()) {
        setEditModalVisible(true);
      }
    } catch (e) {
      if (e?.message === 'COMPANY_NAME_INVALID') {
        // Компании ещё нет — открываем модалку для ввода имени
        setEditModalVisible(true);
      } else {
        Alert.alert(t('error'), e.message);
      }
    }
  };

  const handleSwitchToPrivate = () => {
    Alert.alert(
      t('deactivateCompanyTitle'),
      t('deactivateCompanyMessage'),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('yes'), style: 'destructive', onPress: async () => {
          try {
            await deactivateCompany();
            const profile = await getCurrentUser();
            onUserUpdate?.(profile);
          } catch (e) {
            if (e.message === 'HAS_ACTIVE_MEMBERS') {
              Alert.alert(t('error'), t('hasActiveMembersError'));
            } else {
              Alert.alert(t('error'), e.message);
            }
          }
        }}
      ]
    );
  };

  const fields = [
    { label: t('companyName'), value: companyInfo.name },
    { label: t('companyPhone'), value: companyInfo.phone },
    { label: t('companyEmail'), value: companyInfo.email },
    { label: t('companyTelegram'), value: companyInfo.telegram },
    { label: t('companyWhatsapp'), value: companyInfo.whatsapp },
    { label: t('companyInstagram'), value: companyInfo.instagram },
    { label: t('companyWorkingHours'), value: companyInfo.workingHours },
  ];
  const filledFields = fields.filter((f) => f.value && f.value.trim());

  return (
    <View style={styles.container}>
      <View style={styles.fixedTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
            <Text style={styles.backArrowText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('company')}</Text>
          {isCompany ? (
            <TouchableOpacity onPress={() => setEditModalVisible(true)} style={styles.headerRight} activeOpacity={0.8}>
              <Text style={styles.editIcon}>✏️</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerRight} />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Work As toggle */}
        <View style={styles.workAsRow}>
          <Text style={styles.workAsLabel}>{t('workAs')}</Text>
          <View style={styles.workAsTabs}>
            <TouchableOpacity
              style={[styles.workAsTab, !isCompany && styles.workAsTabActive]}
              onPress={isCompany ? handleSwitchToPrivate : undefined}
              activeOpacity={isCompany ? 0.7 : 1}
            >
              <Text style={[styles.workAsTabText, !isCompany && styles.workAsTabTextActive]}>
                {t('workAsPrivate')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.workAsTab, isCompany && styles.workAsTabActive]}
              onPress={!isCompany ? handleSwitchToCompany : undefined}
              activeOpacity={!isCompany ? 0.7 : 1}
            >
              <Text style={[styles.workAsTabText, isCompany && styles.workAsTabTextActive]}>
                {t('workAsCompany')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isCompany ? (
          <Text style={styles.emptyMessage}>{t('workAsPrivateMessage')}</Text>
        ) : (
          <>
            {/* Company Info block */}
            <Text style={styles.sectionTitle}>{t('companyInfo')}</Text>
            <View style={styles.infoBlock}>
              {companyInfo.logoUrl ? (
                <Image source={{ uri: companyInfo.logoUrl }} style={styles.logo} />
              ) : null}
              {filledFields.length > 0 ? (
                filledFields.map((f, i) => (
                  <View key={i} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{f.label}:</Text>
                    <Text style={styles.fieldValue}>{f.value}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>{t('companyNoData')}</Text>
              )}
            </View>

            {/* Team block */}
            <Text style={styles.sectionTitle}>{t('companyTeam')}</Text>
            <View style={styles.infoBlock}>
              {!showInviteForm && (
                <View style={s.headerRow}>
                  <TouchableOpacity style={s.inviteBtn} onPress={() => setShowInviteForm(true)}>
                    <Text style={s.inviteBtnText}>+ {t('inviteAgent')}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {inviteToast && (
                <View style={s.toastCard}>
                  <Text style={s.toastText}>
                    ✉️ {(inviteToast.resent ? t('inviteEmailResent') : t('inviteEmailSent')).replace('{email}', inviteToast.email)}
                  </Text>
                  <TouchableOpacity onPress={() => setInviteToast(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={s.toastClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {showInviteForm && (
                <View style={s.inviteForm}>
                  <Text style={s.inviteFormLabel}>{t('inviteEmailLabel')}</Text>
                  <TextInput
                    style={s.inviteInput}
                    value={inviteEmail}
                    onChangeText={(v) => { setInviteEmail(v); setInviteError(''); }}
                    placeholder="agent@example.com"
                    placeholderTextColor={C.muted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoFocus
                  />
                  {!!inviteError && <Text style={s.inviteErrorText}>{inviteError}</Text>}
                  <View style={s.inviteFormActions}>
                    <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowInviteForm(false); setInviteEmail(''); setInviteError(''); }}>
                      <Text style={s.cancelBtnText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.sendBtn, (!inviteEmail.trim() || inviting) && s.sendBtnDisabled]} onPress={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                      {inviting ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={s.sendBtnText}>{t('inviteAgent')}</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {loadingTeam && (
                <View style={s.loadingWrap}>
                  <ActivityIndicator size="small" color={ACCENT} />
                </View>
              )}

              {!loadingTeam && activeMembers.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>{t('teamMembers')}</Text>
                  {activeMembers.map((m) => (
                    <MemberRow
                      key={m.member_id}
                      member={m}
                      isCurrentUser={m.user_id === currentUserId}
                      onPress={() => setSelectedMember(m)}
                      onDeactivate={m.role === 'agent' && m.user_id !== currentUserId ? () => setDeactivateTarget(m.user_id) : undefined}
                    />
                  ))}
                </View>
              )}

              {!loadingTeam && archivedMembers.length > 0 && (
                <View style={s.section}>
                  <TouchableOpacity onPress={() => setArchiveOpen(!archiveOpen)} activeOpacity={0.7}>
                    <Text style={s.archiveToggle}>
                      {archiveOpen ? '▼' : '▶'} {t('teamArchive')} ({archivedMembers.length})
                    </Text>
                  </TouchableOpacity>
                  {archiveOpen && archivedMembers.map((m) => (
                    <View key={m.member_id} style={s.archivedMemberRow}>
                      <View style={s.memberAvatar}>
                        <Text style={s.memberAvatarText}>{(m.name || '?')[0].toUpperCase()}</Text>
                      </View>
                      <View style={s.archivedMemberInfo}>
                        <Text style={s.archivedMemberName}>{[m.name, m.last_name].filter(Boolean).join(' ') || '—'}</Text>
                        <Text style={s.archivedMemberDate}>{m.joined_at ? new Date(m.joined_at).toLocaleDateString() : ''}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {!loadingTeam && invitations.length > 0 && (
                <View style={s.section}>
                  <Text style={s.sectionLabel}>{t('teamInvitations')}</Text>
                  {invitations.filter((inv) => inv.status !== 'revoked').map((inv) => (
                    <InvitationRow
                      key={inv.id}
                      invitation={inv}
                      onRevoke={(id) => setRevokeTarget(id)}
                      onResend={handleResend}
                    />
                  ))}
                </View>
              )}

              {!loadingTeam && activeMembers.length === 0 && invitations.length === 0 && !showInviteForm && (
                <Text style={s.emptyText}>{t('teamEmpty')}</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <CompanyEditModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        companyInfo={user?.companyInfo || {}}
        onSave={async (payload) => {
          try {
            if (user?.companyId) {
              await updateCompany(user.companyId, payload);
            } else {
              await activateCompany(payload);
            }
            const profile = await getCurrentUser();
            onUserUpdate?.(profile);
          } catch (e) {
            if (e?.message === 'COMPANY_NAME_INVALID') {
              Alert.alert(t('error'), t('companyNameInvalid'));
            } else {
              Alert.alert(t('error'), e.message);
            }
          }
        }}
      />

      {selectedMember && (
        <MemberPermissionsModal
          member={selectedMember}
          companyId={companyId}
          visible={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={async (memberId, permissions) => {
            await updateMemberPermissions(memberId, permissions);
            setMembers((prev) => prev.map((m) => m.member_id === memberId ? { ...m, permissions } : m));
          }}
        />
      )}

      <ConfirmModal
        visible={!!revokeTarget}
        title={t('inviteRevokeTitle')}
        message={t('inviteRevokeMessage')}
        confirmLabel={t('inviteRevoke')}
        onConfirm={handleRevoke}
        onCancel={() => { setRevokeTarget(null); setRevokeError(''); }}
        loading={revoking}
        error={revokeError}
      />

      <ConfirmModal
        visible={!!deactivateTarget}
        title={t('deactivateTitle')}
        message={t('deactivateMessage')}
        confirmLabel={t('dismiss')}
        onConfirm={handleDeactivate}
        onCancel={() => { setDeactivateTarget(null); setDeactivateError(''); }}
        loading={deactivating}
        error={deactivateError}
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
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  editIcon: {
    fontSize: 20,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 88,
  },
  workAsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  workAsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.title,
  },
  workAsTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  workAsTab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C0C0C0',
  },
  workAsTabActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  workAsTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.title,
  },
  workAsTabTextActive: {
    color: '#FFFFFF',
  },
  emptyMessage: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 40,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'left',
    marginBottom: 8,
  },
  infoBlock: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignSelf: 'center',
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 14,
    color: COLORS.fieldLabel,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.fieldValue,
    marginLeft: 8,
  },
  noDataText: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
});

const s = StyleSheet.create({
  loadingWrap: { padding: 20, alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 12 },
  inviteBtn: { backgroundColor: ACCENT, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  inviteBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },

  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: ACCENT + '20', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 15, fontWeight: '700', color: ACCENT },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 14, fontWeight: '600', color: C.text },
  memberEmail: { fontSize: 12, color: C.muted, marginTop: 1 },
  memberMeta: { alignItems: 'flex-end', gap: 4 },
  roleBadge: { backgroundColor: C.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  roleBadgeOwner: { backgroundColor: ACCENT + '15' },
  roleBadgeText: { fontSize: 11, fontWeight: '700', color: C.muted },
  roleBadgeTextOwner: { color: ACCENT },
  memberDate: { fontSize: 11, color: C.muted },

  invitationRow: { borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 8, overflow: 'hidden' },
  invitationRowExpired: { backgroundColor: C.bg, opacity: 0.85 },
  invitationMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  invitationInfo: { flex: 1, gap: 4 },
  invitationEmail: { fontSize: 13, fontWeight: '600', color: C.text },
  invitationActions: { flexDirection: 'row', gap: 8 },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgePending: { backgroundColor: '#E3F2FD' },
  statusBadgeExpired: { backgroundColor: '#ECEFF1' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#E65100' },
  resendBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: ACCENT },
  resendBtnText: { fontSize: 12, color: '#FFF', fontWeight: '700' },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FFCDD2', backgroundColor: C.dangerBg },
  revokeBtnText: { fontSize: 12, color: C.danger, fontWeight: '700' },

  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.successBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  toastText: { flex: 1, fontSize: 13, color: '#15803D', fontWeight: '600' },
  toastClose: { fontSize: 14, color: C.muted, fontWeight: '700', marginLeft: 12 },

  inviteForm: { backgroundColor: C.bg, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border, gap: 8 },
  inviteFormLabel: { fontSize: 13, fontWeight: '600', color: C.text },
  inviteInput: { height: 40, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: C.text, backgroundColor: '#FFF' },
  inviteErrorText: { fontSize: 12, color: C.danger, marginTop: 2 },
  inviteFormActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: C.muted },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: ACCENT },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  emptyText: { fontSize: 13, color: C.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },

  archiveToggle: { fontSize: 14, fontWeight: '600', color: ACCENT, paddingVertical: 8 },
  archivedMemberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0EDE6' },
  archivedMemberInfo: { flex: 1, marginLeft: 12 },
  archivedMemberName: { fontSize: 15, fontWeight: '600', color: '#2C2C2C' },
  archivedMemberDate: { fontSize: 13, color: '#888', marginTop: 2 },

  permTagsRow: { flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  permTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  permTagActive: { backgroundColor: ACCENT + '12', borderColor: ACCENT + '35' },
  permTagText: { fontSize: 10, fontWeight: '500', color: C.muted },
  permTagTextActive: { color: ACCENT, fontWeight: '700' },
  memberEditHint: { fontSize: 14, color: C.muted },
  dismissBtn: { marginTop: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#FFCDD2', backgroundColor: C.dangerBg },
  dismissBtnText: { fontSize: 10, fontWeight: '700', color: C.danger },

  saveErrorWrap: { paddingHorizontal: 24, paddingBottom: 4 },
  saveErrorText: { fontSize: 13, color: C.danger, lineHeight: 19 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  confirmBoxWrap: { width: '100%', maxWidth: 380 },
  confirmBox: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 24,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  confirmMessage: { fontSize: 14, color: C.muted, lineHeight: 21, marginBottom: 20 },
  confirmErrorText: { fontSize: 13, color: C.danger, marginBottom: 12 },
  confirmActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  confirmCancelBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.bg },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: C.muted },
  confirmDangerBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#FFCDD2', backgroundColor: C.dangerBg },
  confirmDangerBtnText: { fontSize: 14, fontWeight: '700', color: C.danger },

  modalBoxWrap: { width: '100%', maxWidth: 480, maxHeight: '85%' },
  modalBox: { backgroundColor: C.surface, borderRadius: 20, overflow: 'hidden' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  modalAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT + '20', alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { fontSize: 20, fontWeight: '800', color: ACCENT },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  modalSubtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  modalCloseBtnText: { fontSize: 14, color: C.muted, fontWeight: '700' },

  modalSection: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  modalSectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.8, marginBottom: 10 },

  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: C.border },
  permissionInfo: { flex: 1, gap: 3 },
  permissionLabel: { fontSize: 14, fontWeight: '600', color: C.text },
  permissionHint: { fontSize: 12, color: C.muted, lineHeight: 17 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: ACCENT },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  locationHint: { fontSize: 12, color: C.muted, marginBottom: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: C.border },
  locationCheckbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  locationCheckboxChecked: { backgroundColor: ACCENT, borderColor: ACCENT },
  locationCheckmark: { fontSize: 12, color: '#FFF', fontWeight: '800' },
  locationName: { fontSize: 14, color: C.text, flex: 1 },

  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', padding: 16, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: C.muted },
  modalSaveBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: ACCENT },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.5 },
});
