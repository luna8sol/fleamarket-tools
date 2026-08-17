import { DEFAULT_AUTO_SAVE_SETTINGS } from './constants';
import { ExtStorageKey, getExtStorage, setExtStorage } from '../../common/ext-storage';
import { AutoSaveSettings } from './types';

/**
 * 再出品後の自動保存設定の読み書き。
 *
 * 一覧ページ・出品フォームタブ・ポップアップのいずれからも参照するため、
 * chrome.storage.local に保存します。
 */

/**
 * 自動保存設定を読み込む（未設定の項目はデフォルト値で補完）
 * @returns 自動保存設定
 */
export async function loadAutoSaveSettings(): Promise<AutoSaveSettings> {
  const stored = await getExtStorage<Partial<AutoSaveSettings>>(
    ExtStorageKey.AUTO_SAVE_SETTINGS,
    {}
  );
  return { ...DEFAULT_AUTO_SAVE_SETTINGS, ...stored };
}

/**
 * 自動保存設定を保存する
 * @param settings 保存する設定
 * @returns 保存に成功したか
 */
export async function saveAutoSaveSettings(settings: AutoSaveSettings): Promise<boolean> {
  return setExtStorage(ExtStorageKey.AUTO_SAVE_SETTINGS, settings);
}
