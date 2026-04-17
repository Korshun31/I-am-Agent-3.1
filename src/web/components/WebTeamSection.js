import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { getTeamData, createInvitation, revokeInvitation, updateMemberPermissions, getAgentLocationAccess, setAgentLocationAccess, deactivateMember } from '../../services/companyService';
import { getCompanyLocations } from '../../services/locationsService';
import { broadcastChange, broadcastMemberDeactivated } from '../../services/companyChannel';
import dayjs from 'dayjs';

const ACCENT = '#3D7D82';
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

function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(text);
  }
}

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

  const toggle = (key) => setPermissions(prev => ({ ...prev, [key]: !prev[key] }));

  const toggleLocation = (locationId) => {
    setAssignedLocationIds(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await onSave(member.member_id, permissions);
      await setAgentLocationAccess(member.user_id, companyId, assignedLocationIds);
      await broadcastChange('permissions');
      onClose();
    } catch (e) {
      console.error('Save permissions error:', e);
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
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
          <View style={s.modalBox}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

            {/* Шапка */}
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

            {/* Раздел: Объекты */}
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>{t('permSectionProperties')}</Text>
              <PermissionToggleRow
                label={t('permCanAddProperty')}
                hint={t('permCanAddPropertyHint')}
                value={!!permissions.can_add_property}
                onToggle={() => toggle('can_add_property')}
              />
              <PermissionToggleRow
                label={t('permCanEditProperty')}
                hint={t('permCanEditPropertyHint')}
                value={!!permissions.can_edit_info}
                onToggle={() => {
                  const newVal = !permissions.can_edit_info;
                  setPermissions(prev => ({ ...prev, can_edit_info: newVal, can_edit_prices: newVal }));
                }}
              />
            </View>

            {/* Раздел: Бронирования */}
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>{t('permSectionBookings')}</Text>
              <PermissionToggleRow
                label={t('permCanBookLabel')}
                hint={t('permCanBookLabelHint')}
                value={!!permissions.can_book}
                onToggle={() => toggle('can_book')}
              />
            </View>

            {/* Раздел: Локации */}
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>{t('permSectionLocations')}</Text>
              {locations.length === 0 ? (
                <Text style={s.locationHint}>{t('permLocationsEmpty')}</Text>
              ) : (
                <>
                  <Text style={s.locationHint}>{t('permLocationsHint')}</Text>
                  {locations.map(loc => {
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

            {/* Ошибка сохранения */}
            {!!saveError && (
              <View style={s.saveErrorWrap}>
                <Text style={s.saveErrorText}>{saveError}</Text>
              </View>
            )}

            {/* Кнопки */}
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
                <Text style={s.modalCancelText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSaveBtn, saving && s.btnDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={s.modalSaveText}>{saving ? `${t('save')}...` : t('save')}</Text>
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
  { key: 'can_add_property', labelKey: 'permTagAdd' },
  { key: 'can_edit_info', labelKey: 'permTagEdit' },
  { key: 'can_book', labelKey: 'permTagBook' },
];

function MemberRow({ member, isCurrentUser, onPress, onDeactivate }) {
  const { t } = useLanguage();
  const initials = ((member.name || '')[0] || (member.email || '')[0] || '?').toUpperCase();
  const displayName = [member.name, member.last_name].filter(Boolean).join(' ') || member.email;
  const roleLabel = member.role === 'admin' ? t('roleOwner') : t('roleAgent');

  return (
    <TouchableOpacity style={s.memberRow} onPress={member.role !== 'admin' ? onPress : undefined} activeOpacity={member.role !== 'admin' ? 0.7 : 1}>
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

function InvitationRow({ invitation, onRevoke }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const statusLabel = invitation.status === 'sent'
    ? t('inviteStatusSent')
    : t('inviteStatusPending');

  const handleCopy = (text, key) => {
    copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const inviteLink = `https://i-am-agent-3-1.vercel.app/?token=${invitation.invite_token}`;

  return (
    <View style={s.invitationRow}>
      <View style={s.invitationMain}>
        <View style={s.invitationInfo}>
          <Text style={s.invitationEmail}>{invitation.email}</Text>
          <View style={[s.statusBadge, invitation.status === 'pending' && s.statusBadgePending]}>
            <Text style={s.statusBadgeText}>{statusLabel}</Text>
          </View>
        </View>
        <View style={s.invitationActions}>
          <TouchableOpacity style={s.detailsBtn} onPress={() => setShowDetails(!showDetails)}>
            <Text style={s.detailsBtnText}>{showDetails ? '▲' : '▼'} {t('inviteDetails')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.revokeBtn} onPress={() => onRevoke(invitation.id)}>
            <Text style={s.revokeBtnText}>{t('inviteRevoke')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showDetails && (
        <View style={s.inviteDetails}>
          <View style={s.inviteDetailRow}>
            <Text style={s.inviteDetailLabel}>{t('inviteLink')}</Text>
            <View style={s.inviteDetailValue}>
              <Text style={s.inviteLinkText} numberOfLines={1}>{inviteLink}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(inviteLink, 'link')}>
                <Text style={s.copyBtnText}>{copied === 'link' ? '✓' : t('copy')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.inviteDetailRow}>
            <Text style={s.inviteDetailLabel}>{t('secretCode')}</Text>
            <View style={s.inviteDetailValue}>
              <Text style={s.secretCodeText}>{invitation.secret_code}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(invitation.secret_code, 'code')}>
                <Text style={s.copyBtnText}>{copied === 'code' ? '✓' : t('copy')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={s.inviteExpiry}>
            {t('inviteExpires')} {dayjs(invitation.expires_at).format('DD MMM YYYY')}
          </Text>
        </View>
      )}
    </View>
  );
}

function InviteSuccessCard({ result, onClose }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(null);

  const handleCopy = (text, key) => {
    copyToClipboard(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <View style={s.successCard}>
      <Text style={s.successTitle}>✅ {t('inviteSent')}</Text>
      <Text style={s.successSubtitle}>{t('inviteSentHint')}</Text>

      <View style={s.successBlock}>
        <Text style={s.successBlockLabel}>{t('inviteLink')}</Text>
        <View style={s.successRow}>
          <Text style={s.successLinkText} numberOfLines={2}>{result.inviteLink}</Text>
          <TouchableOpacity
            style={[s.copyBtn, copied === 'link' && s.copyBtnSuccess]}
            onPress={() => handleCopy(result.inviteLink, 'link')}
          >
            <Text style={s.copyBtnText}>{copied === 'link' ? `✓ ${t('copied')}` : t('copy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.successBlock}>
        <Text style={s.successBlockLabel}>{t('secretCode')}</Text>
        <View style={s.successRow}>
          <Text style={s.secretCodeBig}>{result.secretCode}</Text>
          <TouchableOpacity
            style={[s.copyBtn, copied === 'code' && s.copyBtnSuccess]}
            onPress={() => handleCopy(result.secretCode, 'code')}
          >
            <Text style={s.copyBtnText}>{copied === 'code' ? `✓ ${t('copied')}` : t('copy')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={s.closeSuccessBtn} onPress={onClose}>
        <Text style={s.closeSuccessBtnText}>{t('close')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function ConfirmModal({ visible, title, message, confirmLabel, onConfirm, onCancel, loading, error }) {
  const { t } = useLanguage();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel} statusBarTranslucent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={loading ? undefined : onCancel}>
        <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
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
                <Text style={s.confirmDangerBtnText}>{loading ? '...' : confirmLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function WebTeamSection({ companyId, currentUserId, teamRefreshKey }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [revokeError, setRevokeError] = useState('');
  const [deactivateError, setDeactivateError] = useState('');

  const loadTeam = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await getTeamData(companyId);
      setMembers(data.members);
      setInvitations(data.invitations);
    } catch (e) {
      console.error('Load team error:', e);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam, teamRefreshKey]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    try {
      const result = await createInvitation(companyId, inviteEmail.trim());
      setInviteResult(result);
      setShowInviteForm(false);
      setInviteEmail('');
      await loadTeam();
    } catch (e) {
      if (e?.message === 'EMAIL_EXISTS') {
        setInviteError(t('inviteEmailExists'));
      } else {
        setInviteError(t('inviteError'));
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError('');
    try {
      await revokeInvitation(revokeTarget);
      setRevokeTarget(null);
      await loadTeam();
    } catch (e) {
      console.error('Revoke error:', e);
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
      await broadcastMemberDeactivated(deactivateTarget);
      setDeactivateTarget(null);
      await loadTeam();
    } catch (e) {
      console.error('Deactivate error:', e);
      setDeactivateError(t('errorSaveSettings'));
    } finally {
      setDeactivating(false);
    }
  };

  const handleCloseSuccess = () => {
    setInviteResult(null);
  };

  if (loading) {
    return (
      <View style={s.loadingWrap}>
        <ActivityIndicator size="small" color={ACCENT} />
      </View>
    );
  }

  const activeMembers = members.filter(m => m.status !== 'inactive');
  const archivedMembers = members.filter(m => m.status === 'inactive');

  return (
    <View style={s.root}>
      {/* Заголовок */}
      <View style={s.header}>
        <Text style={s.title}>👥 {t('team')}</Text>
        {!showInviteForm && !inviteResult && (
          <TouchableOpacity style={s.inviteBtn} onPress={() => setShowInviteForm(true)}>
            <Text style={s.inviteBtnText}>+ {t('inviteAgent')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Результат приглашения */}
      {inviteResult && (
        <InviteSuccessCard result={inviteResult} onClose={handleCloseSuccess} />
      )}

      {/* Форма приглашения */}
      {showInviteForm && !inviteResult && (
        <View style={s.inviteForm}>
          <Text style={s.inviteFormLabel}>{t('inviteEmailLabel')}</Text>
          <TextInput
            style={s.inviteInput}
            value={inviteEmail}
            onChangeText={v => { setInviteEmail(v); setInviteError(''); }}
            placeholder="agent@example.com"
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
              <Text style={s.sendBtnText}>{inviting ? '...' : t('inviteAgent')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Список участников */}
      {activeMembers.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('teamMembers')}</Text>
          {activeMembers.map(m => (
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

      {archivedMembers.length > 0 && (
        <View style={s.section}>
          <TouchableOpacity onPress={() => setArchiveOpen(!archiveOpen)} activeOpacity={0.7}>
            <Text style={s.archiveToggle}>
              {archiveOpen ? '▼' : '▶'} {t('teamArchive')} ({archivedMembers.length})
            </Text>
          </TouchableOpacity>
          {archiveOpen && archivedMembers.map(m => (
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

      {/* Активные приглашения */}
      {invitations.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('teamInvitations')}</Text>
          {invitations.map(inv => (
            <InvitationRow key={inv.id} invitation={inv} onRevoke={(id) => setRevokeTarget(id)} />
          ))}
        </View>
      )}

      {selectedMember && (
        <MemberPermissionsModal
          member={selectedMember}
          companyId={companyId}
          visible={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={async (memberId, permissions) => {
            await updateMemberPermissions(memberId, permissions);
            setMembers(prev => prev.map(m => m.member_id === memberId ? { ...m, permissions } : m));
          }}
        />
      )}

      {activeMembers.length === 0 && invitations.length === 0 && !showInviteForm && !inviteResult && (
        <Text style={s.emptyText}>{t('teamEmpty')}</Text>
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

const s = StyleSheet.create({
  root: { marginTop: 16 },
  loadingWrap: { padding: 20, alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '800', color: ACCENT },
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
  invitationMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  invitationInfo: { flex: 1, gap: 4 },
  invitationEmail: { fontSize: 13, fontWeight: '600', color: C.text },
  invitationActions: { flexDirection: 'row', gap: 8 },
  statusBadge: { alignSelf: 'flex-start', backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusBadgePending: { backgroundColor: '#E3F2FD' },
  statusBadgeText: { fontSize: 11, fontWeight: '700', color: '#E65100' },
  detailsBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: C.border },
  detailsBtnText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  revokeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#FFCDD2', backgroundColor: C.dangerBg },
  revokeBtnText: { fontSize: 12, color: C.danger, fontWeight: '700' },

  inviteDetails: { backgroundColor: C.bg, padding: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  inviteDetailRow: { gap: 4 },
  inviteDetailLabel: { fontSize: 11, fontWeight: '600', color: C.muted },
  inviteDetailValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inviteLinkText: { flex: 1, fontSize: 12, color: C.text, fontFamily: 'monospace' },
  secretCodeText: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: 4 },
  inviteExpiry: { fontSize: 11, color: C.muted, fontStyle: 'italic' },

  copyBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: ACCENT + '15', borderWidth: 1, borderColor: ACCENT + '40' },
  copyBtnSuccess: { backgroundColor: C.successBg, borderColor: C.success },
  copyBtnText: { fontSize: 12, fontWeight: '700', color: ACCENT },

  inviteForm: { backgroundColor: C.bg, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: C.border, gap: 8 },
  inviteFormLabel: { fontSize: 13, fontWeight: '600', color: C.text },
  inviteInput: { height: 40, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, fontSize: 14, color: C.text, backgroundColor: '#FFF', outlineWidth: 0 },
  inviteErrorText: { fontSize: 12, color: C.danger, marginTop: 2 },
  inviteFormActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: C.muted },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: ACCENT },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  successCard: { backgroundColor: C.successBg, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#BBF7D0', gap: 12 },
  successTitle: { fontSize: 15, fontWeight: '800', color: C.success },
  successSubtitle: { fontSize: 12, color: '#4A7D62' },
  successBlock: { gap: 6 },
  successBlockLabel: { fontSize: 12, fontWeight: '600', color: '#4A7D62' },
  successRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  successLinkText: { flex: 1, fontSize: 12, color: C.text, fontFamily: 'monospace' },
  secretCodeBig: { fontSize: 28, fontWeight: '900', color: C.text, letterSpacing: 6 },
  closeSuccessBtn: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: C.success },
  closeSuccessBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  emptyText: { fontSize: 13, color: C.muted, fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },

  archiveToggle: { fontSize: 14, fontWeight: '600', color: '#3D7D82', paddingVertical: 8 },
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

  // ── Confirm modal ──
  confirmBox: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 28,
    width: 380,
    maxWidth: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
  },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 8 },
  confirmMessage: { fontSize: 14, color: C.muted, lineHeight: 21, marginBottom: 20 },
  confirmErrorText: { fontSize: 13, color: C.danger, marginBottom: 12 },
  confirmActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  confirmCancelBtn: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.bg,
  },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: C.muted },
  confirmDangerBtn: {
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1,
    borderColor: '#FFCDD2', backgroundColor: C.dangerBg,
  },
  confirmDangerBtnText: { fontSize: 14, fontWeight: '700', color: C.danger },

  // ── Agent modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  modalBox: { backgroundColor: C.surface, borderRadius: 20, width: 480, maxWidth: '95%', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.2, shadowRadius: 32, overflow: 'hidden' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 24, borderBottomWidth: 1, borderBottomColor: C.border },
  modalAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT + '20', alignItems: 'center', justifyContent: 'center' },
  modalAvatarText: { fontSize: 20, fontWeight: '800', color: ACCENT },
  modalTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  modalSubtitle: { fontSize: 13, color: C.muted, marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  modalCloseBtnText: { fontSize: 14, color: C.muted, fontWeight: '700' },

  modalSection: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 },
  modalSectionTitle: { fontSize: 11, fontWeight: '700', color: C.muted, letterSpacing: 0.8, marginBottom: 12 },

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

  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', padding: 20, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: C.muted },
  modalSaveBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: ACCENT },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.5 },
});
