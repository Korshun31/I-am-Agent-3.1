import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Logo, { COLORS } from '../components/Logo';
import { signIn, signInWithGoogle, signInWithFacebook } from '../services/authService';

// Тени в стиле макета: выраженные drop shadow, «слоистость»
const inputShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.12,
  shadowRadius: 6,
  elevation: 4,
};
const labelShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 3,
  elevation: 3,
};
const buttonShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.15,
  shadowRadius: 6,
  elevation: 5,
};

export default function Login({ onSignUp, onLogin }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      Alert.alert(t('error'), e.message);
    }
  };

  const handleFacebookLogin = async () => {
    try {
      await signInWithFacebook();
    } catch (e) {
      Alert.alert(t('error'), e.message);
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
        <Text style={styles.tagline}>{t('tagline')}</Text>

        <View style={styles.form}>
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, styles.labelStickerEmail]}>
              <Text style={styles.labelBannerText}>{t('email')}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputEmail, inputShadow]}
              placeholder="mail@mail.com"
              placeholderTextColor="#777"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <View style={styles.fieldWrap}>
            <View style={[styles.labelSticker, styles.labelStickerPassword]}>
              <Text style={styles.labelBannerText}>{t('password')}</Text>
            </View>
            <TextInput
              style={[styles.input, styles.inputPassword, inputShadow]}
              placeholder="••••••••"
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, buttonShadow]}
            activeOpacity={0.8}
            onPress={async () => {
              const em = (email || '').trim();
              const pw = password || '';
              if (!em) {
                Alert.alert(t('error'), t('enterEmail'));
                return;
              }
              if (!pw) {
                Alert.alert(t('error'), t('enterPassword'));
                return;
              }
              try {
                const userData = await signIn({ email: em, password: pw });
                onLogin?.(userData);
              } catch (err) {
                const msg = err?.message || '';
                if (msg.includes('Invalid login credentials')) {
                  Alert.alert(t('error'), t('wrongPassword'));
                } else {
                  Alert.alert(t('error'), msg || t('saveFailed'));
                }
              }
            }}
          >
            <Text style={styles.loginButtonText}>{t('login')}</Text>
          </TouchableOpacity>

          <Text style={styles.orText}>{t('orSignIn')}</Text>
          <View style={styles.socialRow}>
            <TouchableOpacity style={[styles.socialBtn, inputShadow]} activeOpacity={0.8} onPress={handleGoogleLogin}>
              <Text style={styles.socialIconGoogle}>G</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.socialBtn, styles.socialBtnFacebook, inputShadow]}
              activeOpacity={0.8}
              onPress={handleFacebookLogin}
            >
              <Text style={styles.socialIconFacebook}>f</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.signUpRow}>
          <Text style={styles.signUpPrompt}>{t('noAccount')}</Text>
          <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
            <Text style={styles.signUpLink}>{t('signUp')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.title,
    marginTop: 14,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginBottom: 32,
  },
  form: {
    width: '100%',
    maxWidth: 340,
  },
  fieldWrap: {
    marginBottom: 22,
    position: 'relative',
  },
  // Стикеры как на странице регистрации: один размер, цвет поля совпадает с цветом метки
  labelSticker: {
    position: 'absolute',
    top: -12,
    right: 12,
    zIndex: 1,
    width: 100,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  labelStickerEmail: {
    backgroundColor: COLORS.stickerYellow,
  },
  labelStickerPassword: {
    backgroundColor: COLORS.stickerBlue,
  },
  labelBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.title,
  },
  input: {
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: COLORS.title,
    borderWidth: 0,
  },
  inputEmail: {
    backgroundColor: COLORS.stickerYellow,
  },
  inputPassword: {
    backgroundColor: COLORS.stickerBlue,
  },
  loginButton: {
    backgroundColor: COLORS.green,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 26,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
  orText: {
    fontSize: 14,
    color: COLORS.subtitle,
    marginBottom: 18,
    textAlign: 'center',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginBottom: 44,
  },
  socialBtn: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  socialBtnFacebook: {
    backgroundColor: COLORS.facebookBlue,
  },
  socialIconGoogle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#5F6368',
  },
  socialIconFacebook: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
  },
  signUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  signUpPrompt: {
    fontSize: 15,
    color: COLORS.subtitle,
  },
  signUpLink: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.signUpPink,
    textDecorationLine: 'underline',
  },
});
