import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';

const ACCENT = '#3D7D82';
const C = {
  bg:       '#F4F6F9',
  surface:  '#FFFFFF',
  border:   '#E9ECEF',
  text:     '#212529',
  muted:    '#6C757D',
  light:    '#ADB5BD',
  accentBg: '#EAF4F5',
};

// Универсальный пикер контактов с поиском и опциональной строкой "+ Создать новый".
// Используется для выбора клиента в форме брони и собственника в форме объекта.
//
// Props:
//   value               — id выбранного контакта или ''
//   contacts            — массив контактов (id, name, lastName, phone)
//   onChange(id)        — пустая строка означает "снять выбор"
//   canCreateContact    — показывать ли строку "+ Создать"
//   onRequestNewContact(prefillName) — вызывается при клике "+ Создать"
//   texts               — { placeholder, searchPlaceholder, addNewLabel, removeLabel, noResults }
export default function ContactPicker({
  value,
  contacts,
  onChange,
  onRequestNewContact,
  canCreateContact,
  texts = {},
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const contact = contacts.find(c => c.id === value);

  const placeholder       = texts.placeholder       || 'Select contact';
  const searchPlaceholder = texts.searchPlaceholder || 'Search…';
  const addNewLabel       = texts.addNewLabel       || '+ Add contact';
  const removeLabel       = texts.removeLabel       || 'Remove';
  const noResults         = texts.noResults         || 'No results';

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const name = `${c.name || ''} ${c.lastName || ''}`.toLowerCase();
    return name.includes(q) || (c.phone || '').includes(q);
  });

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  return (
    <View>
      <TouchableOpacity style={s.pickerTrigger} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        {contact ? (
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.contactAvatar}>
              <Text style={s.contactAvatarText}>
                {(contact.name || contact.lastName || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={s.pickerMainText}>
                {`${contact.name || ''} ${contact.lastName || ''}`.trim() || '—'}
              </Text>
              {contact.phone ? <Text style={s.pickerSubText}>{contact.phone}</Text> : null}
            </View>
          </View>
        ) : (
          <Text style={s.pickerPlaceholder}>{placeholder}</Text>
        )}
        <Text style={s.pickerChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={s.dropdown}>
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={searchPlaceholder}
              placeholderTextColor={C.light}
            />
            {search ? (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Text style={s.searchClear}>✕</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled>
            {canCreateContact && (
              <TouchableOpacity
                style={s.addNewContactRow}
                onPress={() => {
                  setOpen(false);
                  onRequestNewContact?.(search);
                }}
              >
                <View style={s.addNewContactIcon}>
                  <Text style={{ fontSize: 15, color: '#FFF', lineHeight: 18, marginTop: -1 }}>+</Text>
                </View>
                <Text style={s.addNewContactText}>
                  {search ? `${addNewLabel} "${search}"` : addNewLabel}
                </Text>
              </TouchableOpacity>
            )}

            {value ? (
              <TouchableOpacity
                style={[s.dropdownItem, { backgroundColor: '#FFF5F5' }]}
                onPress={() => { onChange(''); setOpen(false); }}
              >
                <Text style={{ fontSize: 13, color: '#DC2626' }}>✕  {removeLabel}</Text>
              </TouchableOpacity>
            ) : null}

            {filtered.length === 0 && (
              <Text style={s.dropdownEmpty}>{noResults}</Text>
            )}
            {filtered.map(c => {
              const isActive = c.id === value;
              const name = `${c.name || ''} ${c.lastName || ''}`.trim();
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.dropdownItem, isActive && { backgroundColor: C.accentBg }]}
                  onPress={() => { onChange(c.id); setOpen(false); setSearch(''); }}
                  activeOpacity={0.75}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    <View style={s.contactAvatar}>
                      <Text style={s.contactAvatarText}>
                        {(name || c.phone || '?')[0].toUpperCase()}
                      </Text>
                    </View>
                    <View>
                      <Text style={s.dropdownItemName}>{name || '—'}</Text>
                      {c.phone ? <Text style={s.dropdownItemSub}>{c.phone}</Text> : null}
                    </View>
                  </View>
                  {isActive && <Text style={{ color: ACCENT, fontSize: 16 }}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pickerTrigger: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.surface, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 9, minHeight: 44,
  },
  pickerMainText:    { fontSize: 14, color: C.text, fontWeight: '500' },
  pickerSubText:     { fontSize: 11, color: C.muted, marginTop: 2 },
  pickerPlaceholder: { flex: 1, fontSize: 14, color: C.light },
  pickerChevron:     { fontSize: 10, color: C.light, marginLeft: 8 },

  dropdown: {
    backgroundColor: C.surface, borderRadius: 10,
    borderWidth: 1.5, borderColor: C.border,
    marginTop: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: C.bg,
    borderBottomWidth: 1, borderBottomColor: C.border, gap: 8,
  },
  searchIcon:  { fontSize: 14 },
  searchInput: {
    flex: 1, fontSize: 13, color: C.text,
    outlineStyle: 'none', padding: 0,
  },
  searchClear: { fontSize: 13, color: C.muted, paddingHorizontal: 4 },

  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  dropdownItemName: { fontSize: 13, fontWeight: '500', color: C.text },
  dropdownItemSub:  { fontSize: 11, color: C.muted, marginTop: 2 },
  dropdownEmpty:    { padding: 16, textAlign: 'center', color: C.muted, fontSize: 13 },

  contactAvatar:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.accentBg, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { fontSize: 13, fontWeight: '700', color: ACCENT },

  addNewContactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
    backgroundColor: '#EAF4F5',
  },
  addNewContactIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
  },
  addNewContactText: { fontSize: 13, fontWeight: '600', color: ACCENT },
});
