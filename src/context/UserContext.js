import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

// TD-020: единый «пустой шаблон» карточки пользователя со всеми каноничными
// полями. Добавление поля сюда автоматически даёт безопасные дефолты на
// всех экранах (читать `user.X` всегда возвращает осмысленное значение, а не
// undefined даже после resetUser).
const initialUser = {
  // Контактные поля
  id: null,
  email: '',
  name: '',
  lastName: '',
  phone: '',
  telegram: '',
  whatsapp: '',
  documentNumber: '',
  photoUri: '',
  extraPhones: [],
  extraEmails: [],
  // Тариф и роли
  plan: 'standard',
  teamRole: null,
  isAgentRole: false,
  isAdminRole: false,
  teamMembership: null,
  teamPermissions: {},
  // Компания
  workAs: 'private',
  companyId: null,
  companyInfo: {},
  // Настройки
  language: 'en',
  selectedCurrency: 'USD',
  notificationSettings: {},
  locations: [],
  web_notifications: {
    new_booking: false,
    booking_changed: false,
    new_event: false,
    new_property: false,
  },
};

function normalizeUser(userData) {
  if (!userData || typeof userData !== 'object') return { ...initialUser };
  return {
    ...initialUser,
    ...userData,
    // Пере-страховка для полей где undefined/null вместо ожидаемых типов
    // ломал бы UI (карты, мапы, циклы).
    extraPhones: Array.isArray(userData.extraPhones) ? userData.extraPhones : [],
    extraEmails: Array.isArray(userData.extraEmails) ? userData.extraEmails : [],
    locations: Array.isArray(userData.locations) ? userData.locations : [],
    teamPermissions: userData.teamPermissions && typeof userData.teamPermissions === 'object' ? userData.teamPermissions : {},
    notificationSettings: userData.notificationSettings && typeof userData.notificationSettings === 'object' ? userData.notificationSettings : {},
    companyInfo: userData.companyInfo && typeof userData.companyInfo === 'object' ? userData.companyInfo : {},
    workAs: userData.workAs === 'company' ? 'company' : 'private',
  };
}

export function UserProvider({ children, onLogout }) {
  const [user, setUser] = useState(initialUser);

  const updateUser = (userData) => {
    setUser(normalizeUser(userData));
  };

  const handleUserUpdate = (updatedUser) => {
    setUser((prev) => normalizeUser({ ...prev, ...(updatedUser || {}) }));
  };

  const resetUser = () => setUser(initialUser);

  return (
    <UserContext.Provider value={{
      user,
      updateUser,
      handleUserUpdate,
      resetUser,
      onLogout,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
