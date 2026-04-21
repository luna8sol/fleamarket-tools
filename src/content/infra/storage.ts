import { error } from './logger';

/**
 * ストレージキー定数
 */
export enum StorageKey {
  SELECTED_ITEMS = 'selectedItems',
  USER_SETTINGS = 'userSettings',
}

/**
 * ローカルストレージにデータを保存
 * @param key ストレージキー
 * @param data 保存するデータ
 * @returns 保存に成功したか
 */
export function saveToStorage<T>(key: StorageKey, data: T): boolean {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    return true;
  } catch (e) {
    error(`ストレージへの保存に失敗しました: ${key}`, e);
    return false;
  }
}

/**
 * ローカルストレージからデータを読み込み
 * @param key ストレージキー
 * @param defaultValue デフォルト値
 * @returns 読み込んだデータまたはデフォルト値
 */
export function loadFromStorage<T>(key: StorageKey, defaultValue: T): T {
  try {
    const serialized = localStorage.getItem(key);
    if (serialized === null) {
      return defaultValue;
    }
    return JSON.parse(serialized) as T;
  } catch (e) {
    error(`ストレージからの読み込みに失敗しました: ${key}`, e);
    return defaultValue;
  }
}

