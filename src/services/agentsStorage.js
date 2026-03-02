import * as FileSystem from 'expo-file-system/legacy';

const FILE_NAME = 'agents.json';

function getFilePath() {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  return dir + FILE_NAME;
}

/**
 * Загружает всех агентов из хранилища (файл в documentDirectory).
 * @returns {Promise<Record<string, { email, password, name, phone, telegram }>>}
 */
async function getAgentsMap() {
  try {
    const path = getFilePath();
    if (!path) return {};
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(path);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Сохраняет карту агентов в файл.
 * @param {Record<string, { email, password, name, phone, telegram }>} map
 */
async function setAgentsMap(map) {
  const path = getFilePath();
  if (!path) return;
  try {
    await FileSystem.writeAsStringAsync(path, JSON.stringify(map));
  } catch (e) {
    console.warn('agentsStorage: failed to save', e);
  }
}

/**
 * Сохраняет агента в базу (при регистрации или обновлении профиля).
 * @param {{ email: string, password: string, name?: string, phone?: string, telegram?: string }} agent
 */
export async function saveAgent(agent) {
  const map = await getAgentsMap();
  const key = (agent.email || '').trim().toLowerCase();
  if (!key) return;
  const existing = map[key] || {};
  map[key] = {
    email: (agent.email || existing.email || '').trim(),
    password: agent.password !== undefined ? agent.password : (existing.password || ''),
    name: agent.name !== undefined ? agent.name : (existing.name || ''),
    lastName: agent.lastName !== undefined ? agent.lastName : (existing.lastName || ''),
    phone: agent.phone !== undefined ? agent.phone : (existing.phone || ''),
    telegram: agent.telegram !== undefined ? agent.telegram : (existing.telegram || ''),
    documentNumber: agent.documentNumber !== undefined ? agent.documentNumber : (existing.documentNumber || ''),
    extraPhones: Array.isArray(agent.extraPhones) ? agent.extraPhones : (existing.extraPhones || []),
    extraEmails: Array.isArray(agent.extraEmails) ? agent.extraEmails : (existing.extraEmails || []),
    whatsapp: agent.whatsapp !== undefined ? agent.whatsapp : (existing.whatsapp || ''),
    photoUri: agent.photoUri !== undefined ? agent.photoUri : (existing.photoUri || ''),
    language: agent.language !== undefined ? agent.language : (existing.language || ''),
    notificationSettings: agent.notificationSettings !== undefined ? agent.notificationSettings : (existing.notificationSettings || {}),
    selectedCurrency: agent.selectedCurrency !== undefined ? agent.selectedCurrency : (existing.selectedCurrency || ''),
    locations: Array.isArray(agent.locations) ? agent.locations : (existing.locations || []),
  };
  await setAgentsMap(map);
}

/**
 * Находит агента по email (для входа). Возвращает полные данные, включая пароль.
 * @param {string} email
 * @returns {Promise<{ email, password, name, phone, telegram } | null>}
 */
export async function getAgentByEmail(email) {
  const key = (email || '').trim().toLowerCase();
  if (!key) return null;
  const map = await getAgentsMap();
  return map[key] || null;
}

/**
 * Возвращает данные агента для отображения в приложении (без пароля).
 * @param {{ email, name, phone, telegram }} agent
 * @returns {{ email: string, name: string, phone: string, telegram: string }}
 */
export function agentToUser(agent) {
  if (!agent) return { email: '', name: '', lastName: '', phone: '', telegram: '', documentNumber: '', extraPhones: [], extraEmails: [], whatsapp: '', photoUri: '' };
  return {
    email: agent.email || '',
    name: agent.name || '',
    lastName: agent.lastName || '',
    phone: agent.phone || '',
    telegram: agent.telegram || '',
    documentNumber: agent.documentNumber || '',
    extraPhones: Array.isArray(agent.extraPhones) ? agent.extraPhones : [],
    extraEmails: Array.isArray(agent.extraEmails) ? agent.extraEmails : [],
    whatsapp: agent.whatsapp || '',
    photoUri: agent.photoUri || '',
  };
}
