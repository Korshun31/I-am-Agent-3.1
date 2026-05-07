import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Хранилище двух связанных состояний:
//  - KICKED: «меня исключили из компании» (с именем компании). Ставится в момент
//    деактивации (postgres_changes) или на cold start если RPC am_i_still_active=false.
//    Читается экраном логина через AppContent → KickedModal.
//  - LAST_COMPANY: имя компании, в которой юзер был при последнем логине. Нужно
//    чтобы при cold start выкинутого взять имя для модалки (после signOut state очищен,
//    а в БД membership уже отфильтрован по active).

const KICKED_KEY = 'app:kickedFromCompany';
const LAST_COMPANY_KEY = 'app:lastCompanyName';

const storage = Platform.OS === 'web'
  ? {
      get: (k) => Promise.resolve(typeof window !== 'undefined' ? window.localStorage.getItem(k) : null),
      set: (k, v) => { if (typeof window !== 'undefined') window.localStorage.setItem(k, v); return Promise.resolve(); },
      remove: (k) => { if (typeof window !== 'undefined') window.localStorage.removeItem(k); return Promise.resolve(); },
    }
  : {
      get: (k) => AsyncStorage.getItem(k),
      set: (k, v) => AsyncStorage.setItem(k, v),
      remove: (k) => AsyncStorage.removeItem(k),
    };

export async function setKickedFlag({ companyName }) {
  await storage.set(KICKED_KEY, JSON.stringify({ companyName: companyName || '' }));
}

export async function getKickedFlag() {
  try {
    const raw = await storage.get(KICKED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearKickedFlag() {
  await storage.remove(KICKED_KEY);
}

export async function setLastCompanyName(name) {
  if (!name) return;
  await storage.set(LAST_COMPANY_KEY, name);
}

export async function getLastCompanyName() {
  try {
    const raw = await storage.get(LAST_COMPANY_KEY);
    return raw || '';
  } catch {
    return '';
  }
}

export async function clearLastCompanyName() {
  await storage.remove(LAST_COMPANY_KEY);
}
