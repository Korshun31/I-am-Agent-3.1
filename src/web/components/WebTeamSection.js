import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useLanguage } from '../../context/LanguageContext';
import { getTeamData, createInvitation, revokeInvitation, updateMemberPermissions } from '../../services/companyService';
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

function MemberPermissionsModal({ member, visible, onClose, onSave }) {
  const { t } = useLanguage();
  const [permissions, setPermissions] = useState(member?.permissions || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (member) setPermissions(member.permissions || {});
  }, [member?.member_id]);

  const toggle = (key) => setPermissions(prev => ({ ...prev, [key]: !prev[key] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(member.member_id, permissions);
      onClose();
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
              <Text style={s.modalSectionTitle}>ОБЪЕКТЫ</Text>
              <PermissionToggleRow
                label="Добавление объектов"
                hint="Агент может добавлять новые объекты — Админ проверяет перед публикацией"
                value={!!permissions.can_add_property}
                onToggle={() => toggle('can_add_property')}
              />
              <PermissionToggleRow
                label="Редактирование основных данных"
                hint="Фото, описание, спальни, удобства, расстояния — без проверки Админа"
                value={!!permissions.can_edit_info}
                onToggle={() => toggle('can_edit_info')}
              />
              <PermissionToggleRow
                label="Редактирование цен"
                hint="Стоимость аренды и депозиты — без проверки Админа"
                value={!!permissions.can_edit_prices}
                onToggle={() => toggle('can_edit_prices')}
              />
            </View>

            {/* Раздел: Бронирования */}
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>БРОНИРОВАНИЯ</Text>
              <PermissionToggleRow
                label={t('permCanBook') || 'Создание бронирований'}
                hint="Агент может создавать и редактировать бронирования своих объектов"
                value={!!permissions.can_book}
                onToggle={() => toggle('can_book')}
              />
              <PermissionToggleRow
                label="Удаление бронирований"
                hint="Агент может удалять бронирования своих объектов"
                value={!!permissions.can_delete_booking}
                onToggle={() => toggle('can_delete_booking')}
              />
            </View>

            {/* Раздел: Финансы */}
            <View style={s.modalSection}>
              <Text style={s.modalSectionTitle}>ФИНАНСЫ</Text>
              <PermissionToggleRow
                label="Просмотр финансовых данных"
                hint="Агент видит комиссии и коммунальные расходы в карточке объекта"
                value={!!permissions.can_see_financials}
                onToggle={() => toggle('can_see_financials')}
              />
            </View>

            {/* Кнопки */}
            <View style={s.modalActions}>
              <TouchableOpacity style={s.modalCancelBtn} onPress={onClose}>
                <Text style={s.modalCancelText}>{t('cancel') || 'Отмена'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalSaveBtn, saving && s.btnDisabled]} onPress={handleSave} disabled={saving}>
                <Text style={s.modalSaveText}>{saving ? '...' : (t('save') || 'Сохранить')}</Text>
              </TouchableOpacity>
            </View>

            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

function MemberRow({ member, isCurrentUser, onPress }) {
  const { t } = useLanguage();
  const initials = ((member.name || '')[0] || (member.email || '')[0] || '?').toUpperCase();
  const displayName = [member.name, member.last_name].filter(Boolean).join(' ') || member.email;
  const roleLabel = member.role === 'owner' ? (t('roleOwner') || 'Admin') : (t('roleAgent') || 'Агент');
  const canBook = member.permissions?.can_book;

  return (
    <TouchableOpacity style={s.memberRow} onPress={member.role !== 'owner' ? onPress : undefined} activeOpacity={member.role !== 'owner' ? 0.7 : 1}>
      <View style={s.memberAvatar}>
        <Text style={s.memberAvatarText}>{initials}</Text>
      </View>
      <View style={s.memberInfo}>
        <Text style={s.memberName}>
          {displayName}{isCurrentUser ? ` (${t('you') || 'Вы'})` : ''}
        </Text>
        <Text style={s.memberEmail}>{member.email}</Text>
        {member.role !== 'owner' && (
          <Text style={s.memberPerms}>
            {canBook ? `✓ ${t('permCanBook') || 'Бронирования'}` : `— ${t('permCanBook') || 'Бронирования'}`}
          </Text>
        )}
      </View>
      <View style={s.memberMeta}>
        <View style={[s.roleBadge, member.role === 'owner' && s.roleBadgeOwner]}>
          <Text style={[s.roleBadgeText, member.role === 'owner' && s.roleBadgeTextOwner]}>
            {roleLabel}
          </Text>
        </View>
        <Text style={s.memberDate}>{dayjs(member.joined_at).format('DD MMM YYYY')}</Text>
        {member.role !== 'owner' && <Text style={s.memberEditHint}>⚙️</Text>}
      </View>
    </TouchableOpacity>
  );
}

function InvitationRow({ invitation, onRevoke }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const statusLabel = invitation.status === 'sent'
    ? (t('inviteStatusSent') || 'Отправлено')
    : (t('inviteStatusPending') || 'Ожидает');

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
            <Text style={s.detailsBtnText}>{showDetails ? '▲' : '▼'} {t('inviteDetails') || 'Детали'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.revokeBtn} onPress={() => onRevoke(invitation.id)}>
            <Text style={s.revokeBtnText}>{t('inviteRevoke') || 'Отозвать'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showDetails && (
        <View style={s.inviteDetails}>
          <View style={s.inviteDetailRow}>
            <Text style={s.inviteDetailLabel}>{t('inviteLink') || 'Ссылка для агента:'}</Text>
            <View style={s.inviteDetailValue}>
              <Text style={s.inviteLinkText} numberOfLines={1}>{inviteLink}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(inviteLink, 'link')}>
                <Text style={s.copyBtnText}>{copied === 'link' ? '✓' : t('copy') || 'Копировать'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.inviteDetailRow}>
            <Text style={s.inviteDetailLabel}>{t('secretCode') || 'Секретный код (передайте лично):'}</Text>
            <View style={s.inviteDetailValue}>
              <Text style={s.secretCodeText}>{invitation.secret_code}</Text>
              <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(invitation.secret_code, 'code')}>
                <Text style={s.copyBtnText}>{copied === 'code' ? '✓' : t('copy') || 'Копировать'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={s.inviteExpiry}>
            {t('inviteExpires') || 'Действует до:'} {dayjs(invitation.expires_at).format('DD MMM YYYY')}
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
      <Text style={s.successTitle}>✅ {t('inviteSent') || 'Приглашение создано!'}</Text>
      <Text style={s.successSubtitle}>
        {t('inviteSentHint') || 'Передайте агенту ссылку и секретный код отдельно (лично или через мессенджер)'}
      </Text>

      <View style={s.successBlock}>
        <Text style={s.successBlockLabel}>{t('inviteLink') || 'Ссылка для агента:'}</Text>
        <View style={s.successRow}>
          <Text style={s.successLinkText} numberOfLines={2}>{result.inviteLink}</Text>
          <TouchableOpacity
            style={[s.copyBtn, copied === 'link' && s.copyBtnSuccess]}
            onPress={() => handleCopy(result.inviteLink, 'link')}
          >
            <Text style={s.copyBtnText}>{copied === 'link' ? '✓ Скопировано' : t('copy') || 'Копировать'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.successBlock}>
        <Text style={s.successBlockLabel}>{t('secretCode') || 'Секретный код (передайте лично):'}</Text>
        <View style={s.successRow}>
          <Text style={s.secretCodeBig}>{result.secretCode}</Text>
          <TouchableOpacity
            style={[s.copyBtn, copied === 'code' && s.copyBtnSuccess]}
            onPress={() => handleCopy(result.secretCode, 'code')}
          >
            <Text style={s.copyBtnText}>{copied === 'code' ? '✓ Скопировано' : t('copy') || 'Копировать'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={s.closeSuccessBtn} onPress={onClose}>
        <Text style={s.closeSuccessBtnText}>{t('close') || 'Закрыть'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function WebTeamSection({ companyId, currentUserId }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteResult, setInviteResult] = useState(null);

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
  }, [loadTeam]);

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
        setInviteError(t('inviteEmailExists') || 'Этот email уже зарегистрирован в системе. Попросите агента указать другой email.');
      } else {
        setInviteError(t('inviteError') || 'Ошибка при создании приглашения. Попробуйте ещё раз.');
      }
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (invitationId) => {
    if (!window.confirm(t('inviteRevokeConfirm') || 'Отозвать приглашение?')) return;
    try {
      await revokeInvitation(invitationId);
      await loadTeam();
    } catch (e) {
      console.error('Revoke error:', e);
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

  return (
    <View style={s.root}>
      {/* Заголовок */}
      <View style={s.header}>
        <Text style={s.title}>👥 {t('team') || 'Команда'}</Text>
        {!showInviteForm && !inviteResult && (
          <TouchableOpacity style={s.inviteBtn} onPress={() => setShowInviteForm(true)}>
            <Text style={s.inviteBtnText}>+ {t('inviteAgent') || 'Пригласить'}</Text>
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
          <Text style={s.inviteFormLabel}>{t('inviteEmailLabel') || 'Email агента:'}</Text>
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
              <Text style={s.cancelBtnText}>{t('cancel') || 'Отмена'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.sendBtn, (!inviteEmail.trim() || inviting) && s.sendBtnDisabled]} onPress={handleInvite} disabled={!inviteEmail.trim() || inviting}>
              <Text style={s.sendBtnText}>{inviting ? '...' : (t('invite') || 'Пригласить')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Список участников */}
      {members.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('teamMembers') || 'Участники'}</Text>
          {members.map(m => (
            <MemberRow
              key={m.member_id}
              member={m}
              isCurrentUser={m.agent_id === currentUserId}
              onPress={() => setSelectedMember(m)}
            />
          ))}
        </View>
      )}

      {/* Активные приглашения */}
      {invitations.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>{t('teamInvitations') || 'Приглашения'}</Text>
          {invitations.map(inv => (
            <InvitationRow key={inv.id} invitation={inv} onRevoke={handleRevoke} />
          ))}
        </View>
      )}

      {selectedMember && (
        <MemberPermissionsModal
          member={selectedMember}
          visible={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          onSave={async (memberId, permissions) => {
            await updateMemberPermissions(memberId, permissions);
            setMembers(prev => prev.map(m => m.member_id === memberId ? { ...m, permissions } : m));
          }}
        />
      )}

      {members.length === 0 && invitations.length === 0 && !showInviteForm && !inviteResult && (
        <Text style={s.emptyText}>{t('teamEmpty') || 'Команда пока пуста. Пригласите первого агента!'}</Text>
      )}
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

  memberPerms: { fontSize: 11, color: C.muted, marginTop: 2 },
  memberEditHint: { fontSize: 14, color: C.muted },

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

  modalActions: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', padding: 20, borderTopWidth: 1, borderTopColor: C.border, marginTop: 8 },
  modalCancelBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  modalCancelText: { fontSize: 14, fontWeight: '600', color: C.muted },
  modalSaveBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: ACCENT },
  modalSaveText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  btnDisabled: { opacity: 0.5 },
});
