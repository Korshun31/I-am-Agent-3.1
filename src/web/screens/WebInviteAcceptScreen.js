import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../services/supabase';
import { signUp, signIn, getUserProfile } from '../../services/authService';
import { joinCompanyViaInvitation } from '../../services/companyService';
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

// Шаги: loading → invalid → enter_code → new_user_form → existing_user_confirm → existing_user_login → success
const STEPS = {
  LOADING: 'loading',
  INVALID: 'invalid',
  ENTER_CODE: 'enter_code',
  NEW_USER_FORM: 'new_user_form',
  EXISTING_USER_CONFIRM: 'existing_user_confirm',
  EXISTING_USER_LOGIN: 'existing_user_login',
  JOINING: 'joining',
  SUCCESS: 'success',
};

export default function WebInviteAcceptScreen({ token, onComplete, onCancel }) {
  const { t } = useLanguage();
  const [step, setStep] = useState(STEPS.LOADING);
  const [invitation, setInvitation] = useState(null);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // Загружаем приглашение по токену
  useEffect(() => {
    async function loadInvitation() {
      try {
        const { data, error } = await supabase.rpc('get_invitation_by_token', { p_token: token });
        if (error || !data || data.length === 0) {
          setStep(STEPS.INVALID);
          return;
        }
        setInvitation(data[0]);
        setStep(STEPS.ENTER_CODE);
      } catch {
        setStep(STEPS.INVALID);
      }
    }
    loadInvitation();
  }, [token]);

  // Проверяем секретный код
  const handleVerifyCode = async () => {
    if (code.length !== 6) { setCodeError(t('inviteEnter6Code')); return; }
    setLoading(true);
    setCodeError('');
    try {
      const { data: result } = await supabase.rpc('verify_invitation_secret', { p_token: token, p_code: code });
      if (result === -1) { setCodeError(t('inviteBlocked')); setLoading(false); return; }
      if (result > 0) { setCodeError(`${t('inviteCodeWrong')} ${t('inviteAttemptsLeft')} ${result}`); setLoading(false); return; }

      // Проверяем есть ли уже аккаунт с этим email
      const { data: exists } = await supabase.rpc('check_email_exists', { p_email: invitation.email });
      if (exists) {
        setStep(STEPS.EXISTING_USER_CONFIRM);
      } else {
        setStep(STEPS.NEW_USER_FORM);
      }
    } catch {
      setCodeError(t('inviteCodeVerifyError'));
    } finally {
      setLoading(false);
    }
  };

  // Регистрация нового пользователя
  const handleRegister = async () => {
    if (!name.trim()) { setFormError(t('inviteEnterName')); return; }
    if (password.length < 6) { setFormError(t('invitePasswordMin')); return; }
    if (password !== confirmPassword) { setFormError(t('invitePasswordMatch')); return; }
    setLoading(true);
    setFormError('');
    setStep(STEPS.JOINING);
    try {
      await signUp({ email: invitation.email, password, name: name.trim() });
      await joinCompanyViaInvitation(token);
      const profile = await getUserProfile((await supabase.auth.getSession()).data.session?.user?.id);
      setStep(STEPS.SUCCESS);
      setTimeout(() => onComplete(profile), 1500);
    } catch (e) {
      setFormError(e?.message || t('inviteRegisterError'));
      setStep(STEPS.NEW_USER_FORM);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <View style={s.card}>
        {/* Логотип */}
        <View style={s.logoRow}>
          <Image source={require('../../../assets/icon.png')} style={s.logo} resizeMode="contain" />
          <Text style={s.appName}>I am Agent</Text>
        </View>

        {/* ЗАГРУЗКА */}
        {step === STEPS.LOADING && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={s.loadingText}>{t('inviteChecking')}</Text>
          </View>
        )}

        {/* НЕВАЛИДНАЯ ССЫЛКА */}
        {step === STEPS.INVALID && (
          <View style={s.center}>
            <Text style={s.errorIcon}>⚠️</Text>
            <Text style={s.errorTitle}>{t('inviteLinkInvalid')}</Text>
            <Text style={s.errorSubtitle}>{t('inviteLinkExpired')}</Text>
            <TouchableOpacity style={s.primaryBtn} onPress={onCancel}>
              <Text style={s.primaryBtnText}>{t('inviteGoHome')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ВВОД КОДА */}
        {step === STEPS.ENTER_CODE && invitation && (
          <View style={s.stepWrap}>
            <Text style={s.companyBadge}>🏢 {invitation.company_name}</Text>
            <Text style={s.stepTitle}>{t('inviteEnterCode')}</Text>
            <Text style={s.stepSubtitle}>
              {t('inviteCodeSubtitle1')} {invitation.company_name}.
              {' '}{t('inviteCodeSubtitle2')}
            </Text>
            <TextInput
              style={[s.codeInput, !!codeError && s.inputError]}
              value={code}
              onChangeText={v => { setCode(v.replace(/\D/g, '').slice(0, 6)); setCodeError(''); }}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            {!!codeError && <Text style={s.errorText}>{codeError}</Text>}
            <TouchableOpacity
              style={[s.primaryBtn, (code.length !== 6 || loading) && s.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={code.length !== 6 || loading}
            >
              <Text style={s.primaryBtnText}>{loading ? t('inviteVerifying') : t('inviteContinue')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelLink} onPress={onCancel}>
              <Text style={s.cancelLinkText}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* НОВЫЙ ПОЛЬЗОВАТЕЛЬ — СОЗДАНИЕ АККАУНТА */}
        {step === STEPS.NEW_USER_FORM && (
          <View style={s.stepWrap}>
            <Text style={s.stepTitle}>{t('inviteCreateAccount')}</Text>
            <Text style={s.stepSubtitle}>Email: {invitation?.email}</Text>
            <TextInput
              style={s.input}
              value={name}
              onChangeText={v => { setName(v); setFormError(''); }}
              placeholder={t('invitePlaceholderName')}
              autoCapitalize="words"
            />
            <TextInput
              style={s.input}
              value={password}
              onChangeText={v => { setPassword(v); setFormError(''); }}
              placeholder={t('invitePlaceholderPassword')}
              secureTextEntry
            />
            <TextInput
              style={s.input}
              value={confirmPassword}
              onChangeText={v => { setConfirmPassword(v); setFormError(''); }}
              placeholder={t('invitePlaceholderConfirmPassword')}
              secureTextEntry
            />
            {!!formError && <Text style={s.errorText}>{formError}</Text>}
            <TouchableOpacity style={[s.primaryBtn, loading && s.btnDisabled]} onPress={handleRegister} disabled={loading}>
              <Text style={s.primaryBtnText}>{loading ? t('inviteCreating') : t('inviteCreateAndJoin')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* СУЩЕСТВУЮЩИЙ ПОЛЬЗОВАТЕЛЬ — ПРЕДУПРЕЖДЕНИЕ */}
        {step === STEPS.EXISTING_USER_CONFIRM && (
          <View style={s.stepWrap}>
            <Text style={s.warningIcon}>⚠️</Text>
            <Text style={s.stepTitle}>{t('inviteEmailExists') || 'Email already registered'}</Text>
            <Text style={s.stepSubtitle}>
              {t('inviteEmailExistsMessage') || 'This email is already registered in I am Agent. To join the team, please ask the administrator to send an invitation to a different email address.'}
            </Text>
            <TouchableOpacity style={s.primaryBtn} onPress={onCancel}>
              <Text style={s.primaryBtnText}>{t('ok') || 'OK'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ПРОЦЕСС ВСТУПЛЕНИЯ */}
        {step === STEPS.JOINING && (
          <View style={s.center}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={s.loadingText}>{t('inviteJoining')}</Text>
          </View>
        )}

        {/* УСПЕХ */}
        {step === STEPS.SUCCESS && (
          <View style={s.center}>
            <Text style={s.successIcon}>🎉</Text>
            <Text style={s.successTitle}>{t('inviteWelcomeTitle')}</Text>
            <Text style={s.stepSubtitle}>{t('inviteSuccessText')} {invitation?.company_name}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: C.surface, borderRadius: 24, padding: 40, width: '100%', maxWidth: 460, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 32 },
  logo: { width: 40, height: 40 },
  appName: { fontSize: 22, fontWeight: '800', color: C.text },
  center: { alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 15, color: C.muted, marginTop: 8 },
  errorIcon: { fontSize: 40 },
  errorTitle: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center' },
  errorSubtitle: { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  stepWrap: { gap: 14 },
  companyBadge: { alignSelf: 'flex-start', backgroundColor: ACCENT + '15', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, fontSize: 13, fontWeight: '700', color: ACCENT },
  stepTitle: { fontSize: 22, fontWeight: '800', color: C.text },
  stepSubtitle: { fontSize: 14, color: C.muted, lineHeight: 21 },
  warningIcon: { fontSize: 36, textAlign: 'center' },
  codeInput: { height: 64, borderWidth: 2, borderColor: C.border, borderRadius: 14, textAlign: 'center', fontSize: 32, fontWeight: '800', letterSpacing: 10, color: C.text, outlineWidth: 0 },
  input: { height: 48, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: C.text, backgroundColor: '#FAFAFA', outlineWidth: 0 },
  inputError: { borderColor: C.danger },
  errorText: { fontSize: 13, color: C.danger, fontWeight: '500' },
  primaryBtn: { height: 52, backgroundColor: ACCENT, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelLink: { alignItems: 'center', paddingVertical: 8 },
  cancelLinkText: { fontSize: 14, color: C.muted, fontWeight: '500' },
  successIcon: { fontSize: 48 },
  successTitle: { fontSize: 22, fontWeight: '800', color: ACCENT, textAlign: 'center' },
});
