import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { activateCompany, deactivateCompany, updateCompany } from '../services/companyService';
import { getCurrentUser } from '../services/authService';
import CompanyEditModal from '../components/CompanyEditModal';

const TOP_INSET = (Constants.statusBarHeight ?? 44) + 12;

const COLORS = {
  background: '#F5F2EB',
  title: '#2C2C2C',
  subtitle: '#5A5A5A',
  backArrow: '#5DB8D4',
  accent: '#3D7D82',
  fieldLabel: '#5A5A5A',
  fieldValue: '#2C2C2C',
  addLink: '#D81B60',
};

export default function CompanyScreen({ onBack, onUserUpdate, onOpenTeam }) {
  const { user = {} } = useUser();
  const { t } = useLanguage();
  const [editModalVisible, setEditModalVisible] = useState(false);

  const companyInfo = user?.companyInfo || {};

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
      Alert.alert(t('error'), e.message);
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

  const isCompany = user.workAs === 'company';

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
              <TouchableOpacity
                onPress={() => onOpenTeam?.()}
                activeOpacity={0.7}
              >
                <Text style={styles.addEmployeeLink}>{t('companyAddEmployee')}</Text>
              </TouchableOpacity>
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
            }
            const profile = await getCurrentUser();
            onUserUpdate?.(profile);
          } catch (e) {
            Alert.alert(t('error'), e.message);
          }
        }}
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
  addEmployeeLink: {
    color: COLORS.addLink,
    fontSize: 15,
    fontWeight: '600',
  },
});
