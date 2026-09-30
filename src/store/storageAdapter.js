import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DB_NAME = 'mibolsillo-db';
const STORE_NAME = 'kv';
const DB_VERSION = 1;

// True solo en navegador real, false en nativo y también false durante el SSR de Expo Router
const esNavegadorReal =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  typeof indexedDB !== 'undefined';

let dbPromise = null;

async function getDb() {
  if (!esNavegadorReal) return null;
  if (!dbPromise) {
    const { openDB } = await import('idb'); // import dinámico: nunca se evalúa en SSR/nativo
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Adaptador único de almacenamiento:
 * - Navegador real (web)  -> IndexedDB, vía "idb"
 * - iOS/Android           -> AsyncStorage
 * - SSR de Expo Router    -> no persiste nada, pero no truena
 */
export const storage = {
  async getItem(key) {
    try {
      if (Platform.OS === 'web') {
        const db = await getDb();
        if (!db) return null; // estamos en SSR, no hay nada que leer
        const valor = await db.get(STORE_NAME, key);
        return valor ?? null;
      }
      return await AsyncStorage.getItem(key);
    } catch (e) {
      console.warn('storage.getItem error:', e);
      return null;
    }
  },

  async setItem(key, value) {
    try {
      if (Platform.OS === 'web') {
        const db = await getDb();
        if (!db) return false; // SSR: no-op silencioso
        await db.put(STORE_NAME, value, key);
        return true;
      }
      await AsyncStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('storage.setItem error:', e);
      return false;
    }
  },

  async removeItem(key) {
    try {
      if (Platform.OS === 'web') {
        const db = await getDb();
        if (!db) return false;
        await db.delete(STORE_NAME, key);
        return true;
      }
      await AsyncStorage.removeItem(key);
      return true;
    } catch (e) {
      console.warn('storage.removeItem error:', e);
      return false;
    }
  },
};