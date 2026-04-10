/**
 * 商品情報の型定義
 */
export interface Item {
  id: string;
  name: string;
  price?: number;
  imageUrl?: string;
}

/**
 * ユーザー設定の型定義
 */
export interface UserSettings {
  waitTimeBetweenRelists: number; // ms
  randomizeWaitTime: boolean;
  maxRandomTime: number; // ms
  autoSelectLatest: boolean;
  maxSelectCount: number;
  debugMode: boolean;
}

/**
 * アプリケーション状態の型定義
 */
export interface AppState {
  processing: boolean;
  currentProcessingIndex: number;
  totalToProcess: number;
}
