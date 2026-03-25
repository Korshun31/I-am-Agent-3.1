import React, { createContext, useContext, useState } from 'react';

const UserContext = createContext(null);

const initialUser = {
  email: '', name: '', lastName: '', phone: '', telegram: '',
  documentNumber: '', extraPhones: [], extraEmails: [],
  whatsapp: '', photoUri: '',
};

export function UserProvider({ children, onLogout }) {
  const [user, setUser] = useState(initialUser);

  const updateUser = (userData) => {
    if (userData && typeof userData === 'object') {
      setUser({
        ...userData,
        email: userData.email || '',
        name: userData.name || '',
        lastName: userData.lastName || '',
        phone: userData.phone || '',
        telegram: userData.telegram || '',
        documentNumber: userData.documentNumber || '',
        extraPhones: Array.isArray(userData.extraPhones) ? userData.extraPhones : [],
        extraEmails: Array.isArray(userData.extraEmails) ? userData.extraEmails : [],
        whatsapp: userData.whatsapp || '',
        photoUri: userData.photoUri || '',
        workAs: userData.workAs === 'company' ? 'company' : 'private',
        companyInfo: userData.companyInfo || {},
      });
    } else {
      setUser(initialUser);
    }
  };

  const handleUserUpdate = (updatedUser) => {
    setUser((prev) => ({
      ...prev,
      ...updatedUser,
      extraPhones: Array.isArray(updatedUser?.extraPhones) ? updatedUser.extraPhones : prev.extraPhones || [],
      extraEmails: Array.isArray(updatedUser?.extraEmails) ? updatedUser.extraEmails : prev.extraEmails || [],
      whatsapp: updatedUser?.whatsapp !== undefined ? updatedUser.whatsapp : prev.whatsapp || '',
      photoUri: updatedUser?.photoUri !== undefined ? updatedUser.photoUri : prev.photoUri || '',
      workAs: updatedUser?.workAs !== undefined ? updatedUser.workAs : prev.workAs || 'private',
      companyInfo: updatedUser?.companyInfo !== undefined ? updatedUser.companyInfo : prev.companyInfo || {},
    }));
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
