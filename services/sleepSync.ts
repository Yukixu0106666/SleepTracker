import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createSleepJournal } from './sleepJournal';

export const sleepJournal = createSleepJournal({ storage: AsyncStorage, uuid: () => Crypto.randomUUID() });
export const getSleepHistory = sleepJournal.history;
const KEY = 'sleepIngestionCredential.v1';
const ENABLED = 'sleepIngestionEnabled.v1';
const endpoint = (process.env.EXPO_PUBLIC_INGESTION_API_URL ?? '').replace(/\/$/, '');
type Credential = { token: string; userId: string; endpoint: string };
let operation: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const result = operation.then(fn);
  operation = result.catch(() => undefined);
  return result;
}
async function credentials(): Promise<Credential | null> {
  if ((await AsyncStorage.getItem(ENABLED)) !== 'true') return null;
  const raw = Platform.OS === 'web'
    ? (typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY))
    : await SecureStore.getItemAsync(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function getSleepSyncStatus() {
  const credential = await credentials();
  return { ...await sleepJournal.status(), configured: Boolean(endpoint), connected: Boolean(credential && credential.endpoint === endpoint) };
}

export function connectSleepSync(token: string) {
  return serial(async () => {
    if (!endpoint) throw new Error('missing_url');
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:')) throw new Error('https_required');
    if (url.username || url.password || url.search || url.hash) throw new Error('invalid_url');
    if (!/^[a-f0-9]{64}$/.test(token.trim())) throw new Error('invalid_token');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${endpoint}/v1/me`, { headers: { Authorization: `Bearer ${token.trim()}` }, signal: controller.signal });
      if (!response.ok) throw new Error('invalid_token');
      const { user_id: userId } = await response.json();
      if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/.test(userId)) throw new Error('invalid_response');
      await sleepJournal.bind(userId, endpoint);
      const value = JSON.stringify({ token: token.trim(), userId, endpoint });
      if (Platform.OS === 'web') sessionStorage.setItem(KEY, value);
      else await SecureStore.setItemAsync(KEY, value);
      await AsyncStorage.setItem(ENABLED, 'true');
    } finally { clearTimeout(timeout); }
    const credential = await credentials();
    if (credential) await sleepJournal.flush(credential, fetch, true);
  });
}

export function disconnectSleepSync() {
  return serial(async () => {
    await AsyncStorage.setItem(ENABLED, 'false');
    if (Platform.OS === 'web') sessionStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  });
}

export function flushSleepUploads(force = false) {
  return serial(async () => {
    const credential = await credentials();
    if (!credential || credential.endpoint !== endpoint) return;
    await sleepJournal.flush(credential, fetch, force);
  });
}

export async function deleteSleepSession(sessionId: string) {
  await sleepJournal.remove(sessionId);
  await AsyncStorage.removeItem('dailyRecommendation');
  void flushSleepUploads().catch(() => undefined);
}
