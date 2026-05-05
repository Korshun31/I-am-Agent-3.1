import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  Linking,
} from 'react-native';
import { supabase } from '../../services/supabase';
import { joinCompanyViaInvitation } from '../../services/companyService';
import { getUserProfile } from '../../services/authService';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT = '#3D7D82';
const C = {
  bg: '#F5F2EB',
  surface: '#FFFFFF',
  border: '#E0D8CC',
  text: '#2C2C2C',
  muted: '#6C757D',
  danger: '#E53935',
  dangerBg: '#FFF5F5',
};

const APP_STORE_URL = 'https://apps.apple.com/app/i-am-agent/id6496850036';

const STEPS = {
  LOADING: 'loading',
  INVALID: 'invalid',
  SWITCH_ACCOUNT: 'switch_account',
  RECLICK: 'reclick',
  FORM: 'form',
  JOINING: 'joining',
  SUCCESS: 'success',
};

export default function WebInviteAcceptScreen({ token, onComplete, onCancel }) {
  const { t } = useLanguage();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [step, setStep] = useState(STEPS.LOADING);
  const [invalidReason, setInvalidReason] = useState(null); // 'revoked' | 'expired' | 'accepted' | 'not_found'
  const [companyName, setCompanyName] = useState('');
  const [currentSessionEmail, setCurrentSessionEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [joinedProfile, setJoinedProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        // First — check invitation status by token (so we can block early on
        // revoked / accepted / expired without showing the form).
        const { data: status, error: statusErr } = await supabase
          .rpc('get_invitation_status', { p_token: token });

        if (cancelled) return;

        if (statusErr) {
          setInvalidReason('not_found');
          setStep(STEPS.INVALID);
          return;
        }
        if (status === 'not_found' || status === 'declined') {
          setInvalidReason('not_found');
          setStep(STEPS.INVALID);
          return;
        }
        if (status === 'revoked') {
          setInvalidReason('revoked');
          setStep(STEPS.INVALID);
          return;
        }
        if (status === 'expired') {
          setInvalidReason('expired');
          setStep(STEPS.INVALID);
          return;
        }
        if (status === 'accepted') {
          setInvalidReason('accepted');
          setStep(STEPS.INVALID);
          return;
        }
        // Whitelist: only 'sent' and 'pending' are acceptable.
        // Any unexpected value defaults to INVALID — protects against future
        // status values added without UI awareness.
        if (status !== 'sent' && status !== 'pending') {
          setInvalidReason('not_found');
          setStep(STEPS.INVALID);
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (cancelled) return;

        const user = data?.user;
        if (error || !user) {
          // Invitation in DB is valid (sent/pending), but the auth session
          // is gone. Most likely the magic-link was already consumed, the
          // orphan auth user was cleaned up during a re-invite, or the link
          // has not been clicked yet at all.
          setInvalidReason('session_invalid');
          setStep(STEPS.INVALID);
          return;
        }

        const meta = user.user_metadata || {};
        const metaToken = meta.invite_token;
        const metaCompany = meta.companyName;

        if (metaToken && metaToken === token) {
          setCompanyName(metaCompany || '');
          setStep(STEPS.FORM);
        } else {
          setCurrentSessionEmail(user.email || '');
          setStep(STEPS.SWITCH_ACCOUNT);
        }
      } catch {
        if (!cancelled) {
          setInvalidReason('not_found');
          setStep(STEPS.INVALID);
        }
      }
    }
    bootstrap();
    return () => { cancelled = true; };
  }, [token]);

  const handleSwitchAccount = async () => {
    try { await supabase.auth.signOut(); } catch {}
    setStep(STEPS.RECLICK);
  };

  const handleSubmit = async () => {
    setFormError('');
    const trimmedName = name.trim();
    if (!trimmedName) { setFormError(t('inviteEnterName')); return; }
    if (password.length < 6) { setFormError(t('invitePasswordMin')); return; }
    if (password !== confirmPassword) { setFormError(t('invitePasswordMatch')); return; }

    setSubmitting(true);
    setStep(STEPS.JOINING);

    try {
      const { error: updErr } = await supabase.auth.updateUser({
        password,
        data: { name: trimmedName },
      });
      if (updErr) throw new Error(updErr.message);

      const { data: userResp } = await supabase.auth.getUser();
      const user = userResp?.user;
      if (!user) throw new Error('Session lost');

      // Invite-flow trigger no longer creates users_profile, so we create
      // it here when the agent finalizes the form. INSERT first; if a row
      // for this id already exists (rare, e.g. legacy state), update ONLY
      // the name — must not overwrite role of an existing user.
      const { error: insertErr } = await supabase
        .from('users_profile')
        .insert({
          id: user.id,
          email: user.email,
          name: trimmedName,
        });
      if (insertErr && insertErr.code !== '23505') {
        throw new Error(insertErr.message);
      }
      if (insertErr && insertErr.code === '23505') {
        const { error: updateErr } = await supabase
          .from('users_profile')
          .update({ name: trimmedName })
          .eq('id', user.id);
        if (updateErr) throw new Error(updateErr.message);
      }

      await joinCompanyViaInvitation(token);

      const profile = await getUserProfile(user.id);
      setJoinedProfile(profile);
      setStep(STEPS.SUCCESS);
    } catch (e) {
      setFormError(e?.message || t('inviteRegisterError'));
      setStep(STEPS.FORM);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCrm = () => {
    if (joinedProfile) onComplete(joinedProfile);
  };

  const handleDownloadApp = () => {
    if (typeof window !== 'undefined' && APP_STORE_URL && APP_STORE_URL !== '#') {
      Linking.openURL(APP_STORE_URL);
    }
  };

  const cardStyle = [s.card, isMobile && s.cardMobile];

  return (
    <View style={s.root}>
      <View style={cardStyle}>
        <View style={s.logoRow}>
          <Image source={require('../../../assets/icon.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.appName}>I am Agent</Text>
        </View>

        {step === STEPS.LOADING && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={s.loadingText}>{t('inviteChecking')}</Text>
          </View>
        )}

        {step === STEPS.INVALID && (
          <View style={s.center}>
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorTitle}>
              {invalidReason === 'revoked'
                ? t('inviteRevokedTitle')
                : invalidReason === 'accepted'
                  ? t('inviteAcceptedTitle')
                  : invalidReason === 'expired'
                    ? t('inviteExpiredTitle')
                    : invalidReason === 'session_invalid'
                      ? t('inviteSessionInvalidTitle')
                      : t('inviteLinkInvalid')}
            </Text>
            <Text style={s.errorSubtitle}>
              {invalidReason === 'revoked'
                ? t('inviteRevokedMessage')
                : invalidReason === 'accepted'
                  ? t('inviteAcceptedMessage')
                  : invalidReason === 'expired'
                    ? t('inviteExpiredMessage')
                    : invalidReason === 'session_invalid'
                      ? t('inviteSessionInvalidMessage')
                      : t('inviteLinkExpired')}
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={onCancel}>
              <Text style={s.primaryBtnText}>{t('inviteGoHome')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === STEPS.SWITCH_ACCOUNT && (
          <View style={s.stepWrap}>
            <Text style={s.warningIcon}>⚠️</Text>
            <Text style={s.stepTitle}>{t('inviteSwitchAccountTitle')}</Text>
            <Text style={s.stepSubtitle}>
              {t('inviteSwitchAccountMessage').replace('{email}', currentSessionEmail)}
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={handleSwitchAccount}>
              <Text style={s.primaryBtnText}>{t('inviteSwitchAccountConfirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelLink} onPress={onCancel}>
              <Text style={s.cancelLinkText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === STEPS.RECLICK && (
          <View style={s.center}>
            <Text style={s.successIcon}>📧</Text>
            <Text style={s.stepTitle}>{t('inviteReclickTitle')}</Text>
            <Text style={s.stepSubtitle}>{t('inviteReclickMessage')}</Text>
          </View>
        )}

        {step === STEPS.FORM && (
          <View style={s.stepWrap}>
            <Text style={s.stepTitle}>{t('inviteWelcomeTitle')}</Text>
            <Text style={s.stepSubtitle}>
              {t('inviteWelcomeMessage').replace('{company}', companyName || 'I am Agent')}
            </Text>

            <TextInput
              style={s.input}
              value={name}
              onChangeText={(v) => { setName(v); setFormError(''); }}
              placeholder={t('invitePlaceholderName')}
              autoCapitalize="words"
              editable={!submitting}
            />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={(v) => { setPassword(v); setFormError(''); }}
              placeholder={t('invitePlaceholderPassword')}
              secureTextEntry
              editable={!submitting}
            />
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={(v) => { setConfirmPassword(v); setFormError(''); }}
              placeholder={t('invitePlaceholderConfirmPassword')}
              secureTextEntry
              editable={!submitting}
            />

            {!!formError && <Text style={s.errorText}>{formError}</Text>}

            <TouchableOpacity
              style={[s.primaryBtn, submitting && s.btnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Text style={s.primaryBtnText}>
                {submitting ? t('inviteCreating') : t('inviteSubmit')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === STEPS.JOINING && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={s.loadingText}>{t('inviteJoining')}</Text>
          </View>
        )}

        {step === STEPS.SUCCESS && (
          <View style={s.center}>
            <Text style={s.successIcon}>🎉</Text>
            <Text style={s.successTitle}>{t('inviteSuccessRegistered')}</Text>
            <Text style={s.stepSubtitle}>
              {t('inviteSuccessWelcome').replace('{company}', companyName || 'I am Agent')}
            </Text>

            {isMobile ? (
              <TouchableOpacity style={s.primaryBtn} onPress={handleDownloadApp}>
                <Text style={s.primaryBtnText}>📱 {t('inviteDownloadApp')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.primaryBtn} onPress={handleOpenCrm}>
                <Text style={s.primaryBtnText}>{t('inviteOpenCrm')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 24,
    padding: 40,
    width: '100%',
    maxWidth: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  cardMobile: { padding: 24, borderRadius: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 },
  logo: { width: 40, height: 40 },
  appName: { fontSize: 22, fontWeight: '800', color: C.text },
  center: { alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: C.muted, marginTop: 8 },
  errorIcon: { fontSize: 40 },
  errorTitle: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' },
  errorSubtitle: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  stepWrap: { gap: 14 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  stepSubtitle: { fontSize: 14, color: C.muted, lineHeight: 21 },
  warningIcon: { fontSize: 36, textAlign: 'center' },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: C.text,
    backgroundColor: '#FAFAFA',
    outlineWidth: 0,
  },
  errorText: { fontSize: 13, color: C.danger, fontWeight: '500' },
  primaryBtn: {
    height: 52,
    backgroundColor: ACCENT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelLink: { alignItems: 'center', paddingVertical: 8 },
  cancelLinkText: { fontSize: 14, color: C.muted, fontWeight: '500' },
  successIcon: { fontSize: 48 },
  successTitle: { fontSize: 22, fontWeight: '800', color: ACCENT, textAlign: 'center' },
});
