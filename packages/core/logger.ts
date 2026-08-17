/**
 * ログ出力のレベル制御（両拡張で共通の骨格）。
 *
 * 2 つの拡張はログの**出力形式が違う**。メルカリ用は接頭辞・時刻・`[LOG]` などのタグを
 * 1 つの文字列にまとめて渡し、ラクマ用は接頭辞を別引数として渡す。どちらの出力も
 * 1 文字も変えないため、ここでは「レベルの閾値を持ち、閾値を満たしたときに console の
 * どのメソッドをどんな引数で呼ぶか」だけを持ち、整形（`format`）と console メソッドの
 * 対応（`consoleMethod`）は各拡張の logger から注入する。
 */

export type LogLevelName = 'debug' | 'log' | 'info' | 'warn' | 'error';

/** レベルの順序。閾値以上のレベルだけが出力される */
const LEVEL_ORDER: Record<LogLevelName, number> = {
  debug: 0,
  log: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export type ConsoleMethod = 'debug' | 'log' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  /**
   * console に渡す引数を組み立てる。`args` は呼び出し側が渡した引数そのまま。
   * 接頭辞・時刻・タグの付け方はここで決める。
   */
  format: (level: LogLevelName, args: unknown[]) => unknown[];
  /** 最初の閾値。既定は 'log'（debug だけ出ない） */
  initialLevel?: LogLevelName;
  /** レベルごとに呼ぶ console のメソッド。省略したレベルは同名のメソッド */
  consoleMethod?: Partial<Record<LogLevelName, ConsoleMethod>>;
}

export interface Logger {
  /** 閾値を変える */
  setLevel(level: LogLevelName): void;
  /** 現在の閾値 */
  getLevel(): LogLevelName;
  /** そのレベルのログが現在の閾値で出力されるか */
  isEnabled(level: LogLevelName): boolean;
  /** 閾値を満たしていれば、format した引数で console のメソッドを呼ぶ */
  emit(level: LogLevelName, args: unknown[]): void;
}

export function createLogger(options: LoggerOptions): Logger {
  let currentLevel: LogLevelName = options.initialLevel ?? 'log';

  const isEnabled = (level: LogLevelName): boolean =>
    LEVEL_ORDER[currentLevel] <= LEVEL_ORDER[level];

  return {
    setLevel(level: LogLevelName): void {
      currentLevel = level;
    },
    getLevel(): LogLevelName {
      return currentLevel;
    },
    isEnabled,
    emit(level: LogLevelName, args: unknown[]): void {
      if (!isEnabled(level)) return;
      const method: ConsoleMethod = options.consoleMethod?.[level] ?? level;
      console[method](...options.format(level, args));
    },
  };
}
