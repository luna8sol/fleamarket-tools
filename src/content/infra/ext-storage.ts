import { error } from './logger';

/**
 * 拡張機能ストレージ（chrome.storage.local）のキー定数
 *
 * localStorageと異なり、chrome.storage.localはポップアップ（chrome-extension://）と
 * コンテンツスクリプト（jp.mercari.com）で同一の領域を共有する。
 */
export enum ExtStorageKey {
  USER_SETTINGS = 'userSettings',
}

/**
 * chrome.storage.localからデータを読み込み
 * @param key ストレージキー
 * @param defaultValue 値が未保存・読み込み失敗の場合に返すデフォルト値
 * @returns 読み込んだデータまたはデフォルト値
 */
export async function getExtStorage<T>(key: ExtStorageKey, defaultValue: T): Promise<T> {
  try {
    const stored = await chrome.storage.local.get(key);
    const value = stored[key];
    return value === undefined ? defaultValue : (value as T);
  } catch (e) {
    error(`拡張機能ストレージからの読み込みに失敗しました: ${key}`, e);
    return defaultValue;
  }
}

/**
 * chrome.storage.localへデータを保存
 * @param key ストレージキー
 * @param data 保存するデータ
 * @returns 保存に成功したか
 */
export async function setExtStorage<T>(key: ExtStorageKey, data: T): Promise<boolean> {
  try {
    await chrome.storage.local.set({ [key]: data });
    return true;
  } catch (e) {
    error(`拡張機能ストレージへの保存に失敗しました: ${key}`, e);
    return false;
  }
}
