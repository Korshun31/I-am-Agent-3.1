import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Animated, ActivityIndicator, Platform, Image,
} from 'react-native';
import { createContact, updateContact } from '../../services/contactsService';
import { supabase } from '../../services/supabase';
import { useLanguage } from '../../context/LanguageContext';

const ACCENT = '#3D7D82';
const C = {
  bg:          '#F4F6F9',
  surface:     '#FFFFFF',
  border:      '#E9ECEF',
  borderFocus: ACCENT,
  text:        '#212529',
  muted:       '#6C757D',
  light:       '#ADB5BD',
  accentBg:    '#EAF4F5',
};

// ─── Contact method types ────────────────────────────────────────────────────

function getMethodTypes(t) {
  return [
    { type: 'phone',    label: t('phoneLabel'), icon: '📞', placeholder: '+66 99 999 9999', keyboardType: 'phone-pad' },
    { type: 'telegram', label: 'Telegram',    icon: '✈️', placeholder: '@username' },
    { type: 'whatsapp', label: 'WhatsApp',    icon: '💬', placeholder: '+66 99 999 9999', keyboardType: 'phone-pad' },
    { type: 'email',    label: 'Email',       icon: '📧', placeholder: 'mail@example.com', keyboardType: 'email-address' },
  ];
}

function methodConfig(type, methodTypes) {
  return methodTypes.find(m => m.type === type) || methodTypes[0];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _uid = 0;
function uid() { return ++_uid; }

function fieldsToMethods(contact) {
  const methods = [];
  if (contact.phone)     methods.push({ id: uid(), type: 'phone',    value: contact.phone });
  if (contact.phone2)    methods.push({ id: uid(), type: 'phone',    value: contact.phone2 });
  const tgs = contact.extraTelegrams || (contact.telegram ? [contact.telegram] : []);
  tgs.forEach(v => v && methods.push({ id: uid(), type: 'telegram', value: v }));
  const was = contact.extraWhatsapps || (contact.whatsapp ? [contact.whatsapp] : []);
  was.forEach(v => v && methods.push({ id: uid(), type: 'whatsapp', value: v }));
  if (contact.email)     methods.push({ id: uid(), type: 'email',    value: contact.email });
  if (contact.email2)    methods.push({ id: uid(), type: 'email',    value: contact.email2 });
  return methods;
}

function methodsToPayload(methods) {
  const phones    = methods.filter(m => m.type === 'phone'    && m.value.trim()).map(m => m.value.trim());
  const telegrams = methods.filter(m => m.type === 'telegram' && m.value.trim()).map(m => m.value.trim());
  const whatsapps = methods.filter(m => m.type === 'whatsapp' && m.value.trim()).map(m => m.value.trim());
  const emails    = methods.filter(m => m.type === 'email'    && m.value.trim()).map(m => m.value.trim());
  return {
    phone:          phones[0]    || '',
    extraPhones:    phones.slice(1),
    extraTelegrams: telegrams,
    extraWhatsapps: whatsapps,
    email:          emails[0]    || '',
    extraEmails:    emails.slice(1),
  };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionCard({ title, children }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      <View style={s.cardBody}>{children}</View>
    </View>
  );
}

function FField({ label, value, onChange, placeholder, keyboardType, dateType }) {
  const [focused, setFocused] = useState(false);
  const isDate = dateType && Platform.OS === 'web';
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.inputWrap, focused && s.inputWrapFocused]}>
        {isDate ? (
          <input
            type="date"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 14, color: value ? C.text : C.light,
              outline: 'none', fontFamily: 'inherit', padding: 0,
              colorScheme: 'light',
            }}
          />
        ) : (
          <TextInput
            style={s.input}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder || ''}
            placeholderTextColor={C.light}
            keyboardType={keyboardType || 'default'}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        )}
      </View>
    </View>
  );
}

function ContactMethodRow({ method, onUpdate, onRemove }) {
  const { t } = useLanguage();
  const [focused, setFocused] = useState(false);
  const cfg = methodConfig(method.type, getMethodTypes(t));
  return (
    <View style={[s.methodRow, focused && s.methodRowFocused]}>
      <Text style={s.methodIcon}>{cfg.icon}</Text>
      <TextInput
        style={s.methodInput}
        value={method.value}
        onChangeText={v => onUpdate(method.id, v)}
        placeholder={cfg.placeholder}
        placeholderTextColor={C.light}
        keyboardType={cfg.keyboardType || 'default'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <TouchableOpacity style={s.methodRemove} onPress={() => onRemove(method.id)}>
        <Text style={s.methodRemoveText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

function TypeSelect({ value, onChange, t }) {
  const opts = [
    { key: 'clients', label: t('client'),      color: '#5B82D6', bg: '#F0F5FD' },
    { key: 'owners',  label: t('owner'),        color: '#C2920E', bg: '#FFFDE7' },
  ];
  return (
    <View style={s.typeRow}>
      {opts.map(opt => (
        <TouchableOpacity
          key={opt.key}
          style={[s.typeBtn, value === opt.key && { backgroundColor: opt.bg, borderColor: opt.color }]}
          onPress={() => onChange(opt.key)}
          activeOpacity={0.8}
        >
          <Text style={[s.typeBtnText, value === opt.key && { color: opt.color, fontWeight: '700' }]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function WebContactEditPanel({ visible, mode, contact, onClose, onSaved, lockType }) {
  const { t } = useLanguage();
  const METHOD_TYPES = getMethodTypes(t);
  const slideAnim = useRef(new Animated.Value(440)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    type: 'clients', name: '', lastName: '',
    nationality: '', birthday: '', documentNumber: '',
  });
  const [contactMethods, setContactMethods] = useState([]);
  const [documents, setDocuments] = useState([]);

  // Animation
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 440, duration: 260, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  // Fill form
  useEffect(() => {
    if (!visible) return;
    setError('');
    if (mode === 'edit' && contact) {
      setForm({
        type:           contact.type || 'clients',
        name:           contact.name || '',
        lastName:       contact.lastName || '',
        nationality:    contact.nationality || '',
        birthday:       contact.birthday || '',
        documentNumber: contact.documentNumber || '',
      });
      setContactMethods(fieldsToMethods(contact));
      setDocuments(contact.documents || []);
    } else {
      setForm({
        type:           lockType || contact?.type || 'clients',
        name:           contact?.name || '',
        lastName:       contact?.lastName || '',
        nationality:    '',
        birthday:       '',
        documentNumber: '',
      });
      setContactMethods([]);
      setDocuments([]);
    }
  }, [visible, mode, contact]);

  const setF = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  const addMethod = (type) => {
    setContactMethods(prev => [...prev, { id: uid(), type, value: '' }]);
  };
  const removeMethod = (id) => {
    setContactMethods(prev => prev.filter(m => m.id !== id));
  };
  const updateMethod = (id, value) => {
    setContactMethods(prev => prev.map(m => m.id === id ? { ...m, value } : m));
  };

  // Web file input for documents
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      setUploadingDoc(true);
      try {
        const urls = await Promise.all(files.map(async file => {
          const ext = file.name.split('.').pop();
          const path = `contacts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from('contact-photos').upload(path, file);
          if (upErr) throw upErr;
          const { data } = supabase.storage.from('contact-photos').getPublicUrl(path);
          return data.publicUrl;
        }));
        setDocuments(prev => [...prev, ...urls]);
      } catch (e) {
        setError(t('errorUpload'));
      } finally {
        setUploadingDoc(false);
        input.value = '';
      }
    };
    fileInputRef.current = input;
    document.body.appendChild(input);
    return () => document.body.removeChild(input);
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { setError(`${t('fieldRequired')}: ${t('ctName')}`); return; }
    setError('');
    setSaving(true);
    try {
      const payload = {
        type:           form.type,
        name:           form.name.trim(),
        lastName:       form.lastName.trim(),
        nationality:    form.nationality.trim(),
        birthday:       form.birthday.trim(),
        documentNumber: form.documentNumber.trim(),
        ...methodsToPayload(contactMethods),
        documents,
      };
      let saved;
      if (mode === 'edit' && contact) {
        saved = await updateContact(contact.id, payload);
      } else {
        saved = await createContact(payload);
      }
      onSaved(saved);
    } catch (e) {
      setError(e.message || t('errorSave'));
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  const title = mode === 'edit' ? t('ctEditTitle') : t('ctNewTitle');

  return (
    <>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropAnim }]} pointerEvents={visible ? 'auto' : 'none'}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[s.panel, { transform: [{ translateX: slideAnim }] }]}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.headerAccent} />
          <View style={s.headerContent}>
            <Text style={s.headerTitle}>{title}</Text>
            <Text style={s.headerSub}>
              {mode === 'edit' ? t('ctEditSub') : t('ctNewSub')}
            </Text>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Тип — скрываем если тип зафиксирован */}
          {!lockType && (
            <SectionCard title={t('ctTypeSection')}>
              <TypeSelect value={form.type} onChange={setF('type')} t={t} />
            </SectionCard>
          )}

          {/* Основное */}
          <SectionCard title={t('tabMain')}>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FField label={`${t('ctName')} *`} value={form.name}     onChange={setF('name')}     placeholder="Ivan" />
              </View>
              <View style={{ flex: 1 }}>
                <FField label={t('ctLastName')}     value={form.lastName} onChange={setF('lastName')} placeholder="Petrov" />
              </View>
            </View>
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <FField label={t('ctNationality')}  value={form.nationality}    onChange={setF('nationality')}    placeholder="Russia" />
              </View>
              <View style={{ flex: 1 }}>
                <FField label={t('ctBirthday')}     value={form.birthday}       onChange={setF('birthday')}       placeholder={t('datePlaceholder')} dateType />
              </View>
            </View>
            <FField label={t('ctDocumentNumber')} value={form.documentNumber} onChange={setF('documentNumber')} placeholder="AB1234567" />
          </SectionCard>

          {/* Контакты */}
          <SectionCard title={t('ctContactsSection')}>
            {contactMethods.length > 0 && (
              <View style={s.methodsList}>
                {contactMethods.map(m => (
                  <ContactMethodRow
                    key={m.id}
                    method={m}
                    onUpdate={updateMethod}
                    onRemove={removeMethod}
                  />
                ))}
              </View>
            )}

            {/* Add pills */}
            <View style={s.addMethodWrap}>
              <Text style={s.addMethodHint}>
                {contactMethods.length === 0 ? t('ctAddContact') : t('ctAddMore')}
              </Text>
              <View style={s.addMethodPills}>
                {METHOD_TYPES.map(mt => (
                  <TouchableOpacity
                    key={mt.type}
                    style={s.addPill}
                    onPress={() => addMethod(mt.type)}
                    activeOpacity={0.75}
                  >
                    <Text style={s.addPillText}>{mt.icon}  + {mt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </SectionCard>

          {/* Документы / Фото */}
          <SectionCard title={t('ctDocsSection')}>
            <Text style={s.docHint}>{t('ctDocsHint')}</Text>
            <View style={s.docGrid}>
              {documents.map((uri, i) => (
                <View key={i} style={s.docThumb}>
                  <Image source={{ uri }} style={s.docImg} resizeMode="cover" />
                  <TouchableOpacity
                    style={s.docRemove}
                    onPress={() => setDocuments(prev => prev.filter((_, idx) => idx !== i))}
                  >
                    <Text style={s.docRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={s.docAdd}
                onPress={() => fileInputRef.current?.click()}
                disabled={uploadingDoc}
              >
                {uploadingDoc
                  ? <ActivityIndicator size="small" color={ACCENT} />
                  : <>
                      <Text style={s.docAddIcon}>+</Text>
                      <Text style={s.docAddText}>{t('tabPhotos')}</Text>
                    </>
                }
              </TouchableOpacity>
            </View>
          </SectionCard>

          {error ? (
            <View style={s.errorBanner}>
              <Text style={s.errorText}>⚠️  {error}</Text>
            </View>
          ) : null}

          <View style={{ height: 8 }} />
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>{t('cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={s.saveBtnText}>{t('save')}</Text>
            }
          </TouchableOpacity>
        </View>

      </Animated.View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    zIndex: 200,
  },
  panel: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: 440, zIndex: 201,
    backgroundColor: C.bg,
    flexDirection: 'column',
    ...Platform.select({ web: { boxShadow: '-6px 0 32px rgba(0,0,0,0.14)' } }),
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface,
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingRight: 16,
  },
  headerAccent:  { width: 4, alignSelf: 'stretch', backgroundColor: '#3D7D82' },
  headerContent: { flex: 1, paddingVertical: 16, paddingHorizontal: 16 },
  headerTitle:   { fontSize: 18, fontWeight: '700', color: C.text, marginBottom: 2 },
  headerSub:     { fontSize: 12, color: C.muted },
  closeBtn:      { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: C.bg },
  closeBtnText:  { fontSize: 15, color: C.muted },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Cards
  card:      { backgroundColor: C.surface, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardTitle: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 13, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  cardBody:  { padding: 14, gap: 10 },

  // Fields
  row2:  { flexDirection: 'row', gap: 10 },
  field: { gap: 5 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.muted },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 11, paddingVertical: 9, minHeight: 42,
  },
  inputWrapFocused: { borderColor: ACCENT },
  input: { flex: 1, fontSize: 14, color: C.text, outlineStyle: 'none', padding: 0 },

  // Type selector
  typeRow: { flexDirection: 'row', gap: 10 },
  typeBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    alignItems: 'center', backgroundColor: C.bg,
  },
  typeBtnText: { fontSize: 14, color: C.muted },

  // Contact methods list
  methodsList: { gap: 8, marginBottom: 4 },
  methodRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.bg, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    paddingLeft: 12, paddingRight: 6, paddingVertical: 6, minHeight: 44,
  },
  methodRowFocused: { borderColor: ACCENT },
  methodIcon:   { fontSize: 17, width: 24, textAlign: 'center' },
  methodInput:  { flex: 1, fontSize: 14, color: C.text, outlineStyle: 'none', padding: 0 },
  methodRemove: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  methodRemoveText: { fontSize: 14, color: C.light },

  // Add pills
  addMethodWrap:  { gap: 8 },
  addMethodHint:  { fontSize: 12, color: C.muted },
  addMethodPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addPill: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: C.surface,
  },
  addPillText: { fontSize: 13, color: C.text, fontWeight: '500' },

  // Documents / photos
  docHint:      { fontSize: 12, color: C.muted, marginBottom: 6 },
  docGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  docThumb:     { width: 80, height: 80, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.border, position: 'relative' },
  docImg:       { width: '100%', height: '100%' },
  docRemove:    { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  docRemoveText:{ fontSize: 10, color: '#FFF', fontWeight: '700' },
  docAdd:       { width: 80, height: 80, borderRadius: 10, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 2 },
  docAddIcon:   { fontSize: 22, color: C.light },
  docAddText:   { fontSize: 11, color: C.muted },

  // Error
  errorBanner: {
    backgroundColor: '#FFF5F5', borderRadius: 8,
    borderWidth: 1, borderColor: '#FCA5A5',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  errorText: { fontSize: 13, color: '#DC2626' },

  // Footer
  footer: {
    flexDirection: 'row', gap: 10, padding: 16,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E9ECEF',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6C757D' },
  saveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#EAF4F5',
    borderWidth: 1.5,
    borderColor: '#B2D8DB',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#3D7D82' },
});
