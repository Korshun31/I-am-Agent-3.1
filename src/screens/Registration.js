import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import Logo, { COLORS } from '../components/Logo';
import { useLanguage } from '../context/LanguageContext';
import { signUp, getCurrentUser } from '../services/authService';
import { supabase } from '../services/supabase';
import { joinCompanyViaInvitation } from '../services/companyService';
import { broadcastOneShot } from '../services/companyChannel';

const COMMON_PASSWORDS = [
  '12345678', '123456789', '1234567890', 'password', 'password1',
  'qwerty12', 'qwertyui', 'qwerty123', 'abc12345', 'abcd1234',
  '11111111', '12341234', '00000000', 'iloveyou', 'sunshine',
  'princess', 'football', 'charlie1', 'trustno1', 'superman',
  'master12', 'welcome1', 'shadow12', 'monkey12', 'dragon12',
  'michael1', 'jennifer', 'jordan23', 'harley12', 'ranger12',
  'batman12', 'andrew12', 'tigger12', 'charlie', 'robert12',
  'thomas12', 'hockey12', 'daniel12', 'starwars', 'klaster1',
  'george12', 'computer', 'michelle', 'jessica1', 'pepper12',
  'zxcvbnm1', 'asdfghjk', 'qazwsxed', 'zaq12wsx', 'passw0rd',
];

const fieldShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
};
const buttonShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.12,
  shadowRadius: 5,
  elevation: 4,
};

// Увеличенный размер стикеров, чтобы «Password» и иконка глаза помещались
const STICKER_LABEL_SIZE = { width: 108, height: 36 };

export default function Registration({ onBack, onSuccess }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteCompany, setInviteCompany] = useState('');
  const [inviteToken, setInviteToken] = useState(null);
  const [inviteCompanyId, setInviteCompanyId] = useState(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteStep, setInviteStep] = useState('choice'); // 'choice' | 'code' | 'blocked'

  const handleRegister = async () => {
    setRegError('');
    const em = (email || '').trim();
    const pw = password || '';
    if (!em) { setRegError(t('enterEmail')); return; }
    if (!pw) { setRegError(t('enterPassword')); return; }
    if (pw.length < 8) { setRegError(t('passwordTooShort')); return; }
    if (COMMON_PASSWORDS.includes(pw.toLowerCase())) { setRegError(t('passwordTooCommon') || 'This password is too common. Please choose a more secure password.'); return; }
    if (pw !== passwordConfirm) { setRegError(t('passwordsMismatch')); return; }
    // TD-040: Check for pending invitation before signUp
    try {
      const { data: inviteData } = await supabase.rpc('check_pending_invitation', { p_email: em });
      if (inviteData && inviteData.length > 0) {
        const inv = inviteData[0];
        setInviteCompany(inv.company_name || '');
        setInviteToken(inv.invite_token || null);
        setInviteCompanyId(inv.company_id || null);
        setInviteCode('');
        setInviteError('');
        if (inv.invitation_status === 'revoked') {
          setInviteStep('blocked');
        } else {
          setInviteStep('choice');
        }
        setInviteModal(true);
        return; // Stop — modal will handle the rest
      }
    } catch (e) {
      // If RPC fails, continue with normal registration
      console.warn('check_pending_invitation failed:', e.message);
    }
    setLoading(true);
    try {
      const userData = await signUp({ email: em, password: pw, name: (name || '').trim() });
      onSuccess?.(userData);
    } catch (err) {
      setRegError(err?.message || t('saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleInviteAccept = async () => {
    if (inviteCode.length !== 6) {
      setInviteError(t('inviteEnter6Code') || 'Enter 6-digit code');
      return;
    }
    setInviteLoading(true);
    setInviteError('');
    try {
      const { data: result } = await supabase.rpc('verify_invitation_secret', {
        p_token: inviteToken,
        p_code: inviteCode,
      });
      if (result === -1) {
        setInviteStep('blocked');
        setInviteError('');
        if (inviteCompanyId) {
          broadcastOneShot(inviteCompanyId, 'team').catch(() => {});
        }
        setInviteLoading(false);
        return;
      }
      if (result > 0) {
        setInviteError(`${t('inviteCodeWrong') || 'Invalid code.'} ${t('inviteAttemptsLeft') || 'Attempts left:'} ${result}`);
        setInviteLoading(false);
        return;
      }
      // result === 0 — code accepted
      // Code accepted — register as agent
      const em = (email || '').trim();
      const pw = password || '';
      await signUp({ email: em, password: pw, name: (name || '').trim() });
      await joinCompanyViaInvitation(inviteToken);
      const freshProfile = await getCurrentUser();
      setInviteModal(false);
      onSuccess?.(freshProfile);
    } catch (e) {
      setInviteError(e?.message || 'Error');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteDecline = async () => {
    setInviteLoading(true);
    try {
      // Mark invitation as declined
      if (inviteToken) {
        await supabase
          .from('company_invitations')
          .update({ status: 'declined' })
          .eq('invite_token', inviteToken);
      }
      setInviteModal(false);
      // Continue with normal registration — user taps "Create account" again
    } catch (e) {
      console.warn('decline failed:', e.message);
      setInviteModal(false);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleInviteDeclineBlocked = async () => {
    setInviteLoading(true);
    try {
      if (inviteToken) {
        await supabase
          .from('company_invitations')
          .update({ status: 'declined' })
          .eq('invite_token', inviteToken);
        if (inviteCompanyId) {
          broadcastOneShot(inviteCompanyId, 'team').catch(() => {});
        }
      }
      setInviteModal(false);
    } catch (e) {
      console.warn('decline blocked failed:', e.message);
      setInviteModal(false);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.wrapper, { backgroundColor: COLORS.backgroundLogin }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Logo size="small" />
        <Text style={styles.appName}>{t('appName')}</Text>
        <Text style={styles.pageTitle}>{t('createAccount')}</Text>

        <View style={styles.form}>
          {/* Name */}
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, { backgroundColor: COLORS.regNameLabel }]}>
              <Text style={styles.labelText}>{t('name')}</Text>
            </View>
            <TextInput
              style={[styles.inputSticker, { backgroundColor: COLORS.regNameBg }, fieldShadow]}
              placeholder="John Smith"
              placeholderTextColor="#888"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          </View>

          {/* E-mail */}
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, { backgroundColor: COLORS.regEmailLabel }]}>
              <Text style={styles.labelText}>{t('email')}</Text>
            </View>
            <TextInput
              ref={emailRef}
              style={[styles.inputSticker, { backgroundColor: COLORS.regEmailBg }, fieldShadow]}
              placeholder="Test@test.com"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, styles.labelWithIcon, { backgroundColor: COLORS.regPasswordLabel }]}>
              <Text style={styles.labelText}>{t('password')}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                <View style={styles.eyeWrap}>
                  <Text style={styles.eyeIcon}>{'\u{1F441}'}</Text>
                  {!showPassword && <View style={styles.eyeSlash} />}
                </View>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={passwordRef}
              style={[styles.inputSticker, { backgroundColor: COLORS.regPasswordBg }, fieldShadow]}
              placeholder="••••••••"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
          </View>

          {/* Password confirm */}
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, styles.labelWithIcon, { backgroundColor: COLORS.regConfirmLabel }]}>
              <Text style={styles.labelText}>{t('password')}</Text>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}
                tabIndex={-1}
              >
                <View style={styles.eyeWrap}>
                  <Text style={styles.eyeIcon}>{'\u{1F441}'}</Text>
                  {!showPasswordConfirm && <View style={styles.eyeSlash} />}
                </View>
              </TouchableOpacity>
            </View>
            <TextInput
              ref={confirmRef}
              style={[styles.inputSticker, { backgroundColor: COLORS.regConfirmBg }, fieldShadow]}
              placeholder={t('confirmPasswordPlaceholder')}
              placeholderTextColor="#888"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!showPasswordConfirm}
              returnKeyType="done"
              onSubmitEditing={handleRegister}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, buttonShadow]}
            activeOpacity={0.8}
            disabled={loading}
            onPress={handleRegister}
          >
            <Text style={styles.submitButtonText}>{loading ? t('saving') : t('createAccountBtn')}</Text>
          </TouchableOpacity>

          {regError ? (
            <Text style={styles.regError}>{regError}</Text>
          ) : null}

          <TouchableOpacity style={styles.backWrap} onPress={onBack} activeOpacity={0.7}>
            <Text style={styles.backLink}>{t('back')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Production 3.1 (2025)</Text>
      </ScrollView>
        {/* TD-040: Invitation modal */}
        <Modal visible={inviteModal} transparent animationType="fade">
          <Pressable style={{
            flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center', alignItems: 'center', padding: 24,
          }} onPress={() => {}}>
            <View style={{
              backgroundColor: '#fff', borderRadius: 20, padding: 24,
              width: '100%', maxWidth: 340,
            }}>
              {inviteStep === 'choice' ? (
                <>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#2C2C2C', marginBottom: 12, textAlign: 'center' }}>
                    🏢 {inviteCompany}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#5A5A5A', marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
                    {t('inviteFoundMessage') || 'An invitation to join this company was sent to your email. Would you like to join the team?'}
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#3D7D82', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
                    onPress={() => setInviteStep('code')}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      {t('inviteAcceptBtn') || 'Accept invitation'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                    onPress={handleInviteDecline}
                    disabled={inviteLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#C62828', fontSize: 15, fontWeight: '600' }}>
                      {t('inviteDeclineBtn') || 'Decline'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : inviteStep === 'blocked' ? (
                <>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#2C2C2C', marginBottom: 12, textAlign: 'center' }}>
                    🏢 {inviteCompany}
                  </Text>
                  <Text style={{ fontSize: 14, color: '#C62828', marginBottom: 20, textAlign: 'center', lineHeight: 20 }}>
                    {t('inviteBlockedMessage') || 'Invitation blocked. Contact the administrator to get a new code.'}
                  </Text>
                  <TouchableOpacity
                    style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#C62828' }}
                    onPress={handleInviteDeclineBlocked}
                    disabled={inviteLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#C62828', fontSize: 15, fontWeight: '600' }}>
                      {t('inviteDeclineInvitation') || 'Decline invitation'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                    onPress={() => setInviteModal(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#5A5A5A', fontSize: 15, fontWeight: '600' }}>
                      {t('ok') || 'OK'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#2C2C2C', marginBottom: 12, textAlign: 'center' }}>
                    {t('inviteEnterCode') || 'Enter secret code'}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#5A5A5A', marginBottom: 16, textAlign: 'center' }}>
                    {t('inviteCodeHint') || 'Ask the company administrator for the 6-digit code'}
                  </Text>
                  <TextInput
                    style={{
                      height: 56, borderWidth: 2, borderColor: '#E0D8CC', borderRadius: 12,
                      textAlign: 'center', fontSize: 28, fontWeight: '800', letterSpacing: 8,
                      color: '#2C2C2C', marginBottom: 12,
                    }}
                    value={inviteCode}
                    onChangeText={v => { setInviteCode(v.replace(/\D/g, '').slice(0, 6)); setInviteError(''); }}
                    placeholder="000000"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  {inviteError ? (
                    <Text style={{ color: '#C62828', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                      {inviteError}
                    </Text>
                  ) : null}
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#3D7D82', borderRadius: 12, paddingVertical: 14,
                      alignItems: 'center', marginBottom: 10,
                      opacity: inviteCode.length !== 6 || inviteLoading ? 0.5 : 1,
                    }}
                    onPress={handleInviteAccept}
                    disabled={inviteCode.length !== 6 || inviteLoading}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                      {inviteLoading ? '...' : (t('inviteJoinBtn') || 'Join team')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ borderRadius: 12, paddingVertical: 10, alignItems: 'center' }}
                    onPress={() => setInviteStep('choice')}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#6B6B6B', fontSize: 14 }}>
                      {t('back') || 'Back'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Pressable>
        </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  appName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.title,
    marginTop: 12,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.title,
    marginBottom: 28,
  },
  form: {
    width: '100%',
    maxWidth: 340,
  },
  fieldWrap: {
    marginBottom: 20,
    position: 'relative',
  },
  labelSticker: {
    position: 'absolute',
    top: -12,
    right: 12,
    zIndex: 1,
    ...STICKER_LABEL_SIZE,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingRight: 4,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.title,
  },
  eyeWrap: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Глаз как в макете: не цветной (серый)
  eyeIcon: {
    fontSize: 16,
    color: '#6B6B6B',
  },
  // Маленькая полосочка поверх глаза, когда пароль скрыт
  eyeSlash: {
    position: 'absolute',
    width: 24,
    height: 1.5,
    backgroundColor: '#6B6B6B',
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  inputSticker: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 0,
  },
  submitButton: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  regError: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginTop: -16,
    marginBottom: 16,
  },
  backWrap: {
    alignSelf: 'flex-start',
    marginBottom: 32,
  },
  backLink: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.backRed,
    textDecorationLine: 'underline',
  },
  footer: {
    fontSize: 12,
    color: COLORS.subtitle,
  },
});
