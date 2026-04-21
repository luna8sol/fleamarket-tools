import { DEFAULT_USER_SETTINGS } from './constants';
import { ExtStorageKey, getExtStorage, setExtStorage } from './ext-storage';
import { UserSettings } from './types';

/**
 * ユーザー設定を読み込む
 *
 * 保存済みの値が一部しか無い場合でも、不足分はDEFAULT_USER_SETTINGSで補完する。
 * @returns ユーザー設定
 */
export async function loadUserSettings(): Promise<UserSettings> {
  const stored = await getExtStorage<Partial<UserSettings>>(ExtStorageKey.USER_SETTINGS, {});
  return { ...DEFAULT_USER_SETTINGS, ...stored };
}

/**
 * ユーザー設定を保存する
 * @param settings 保存するユーザー設定
 * @returns 保存に成功したか
 */
export async function saveUserSettings(settings: UserSettings): Promise<boolean> {
  return setExtStorage(ExtStorageKey.USER_SETTINGS, settings);
}
