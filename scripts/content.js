/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/common/dom.ts":
/*!***************************!*\
  !*** ./src/common/dom.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   safeAppend: () => (/* binding */ safeAppend),
/* harmony export */   safeCreateElement: () => (/* binding */ safeCreateElement),
/* harmony export */   safeGetAttr: () => (/* binding */ safeGetAttr),
/* harmony export */   safePrepend: () => (/* binding */ safePrepend),
/* harmony export */   safeQuery: () => (/* binding */ safeQuery),
/* harmony export */   safeQueryAll: () => (/* binding */ safeQueryAll),
/* harmony export */   safeSetAttr: () => (/* binding */ safeSetAttr)
/* harmony export */ });
/**
 * DOM操作のラップ関数と例外安全なユーティリティ
 *
 * - 例外安全性・null安全性を重視したDOM操作API群です。
 * - すべてのDOM操作はtry-catchでラップされ、失敗時もアプリが落ちません。
 * - どのレイヤーからもimportして利用可能です。
 * - 新たなDOM操作ラッパーはこのファイルに追加してください。
 */
/**
 * セレクタで要素を安全に取得する。
 *
 * @template T 取得する要素型
 * @param selector CSSセレクタ
 * @param parent 親要素（省略時はdocument）
 * @returns {T | null} 見つかった要素、またはnull
 * @example
 *   const btn = safeQuery<HTMLButtonElement>('#myBtn');
 */
function safeQuery(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    }
    catch (e) {
        console.warn('safeQuery error:', e, selector, parent);
        return null;
    }
}
/**
 * セレクタで複数要素を安全に取得する。
 *
 * @template T 取得する要素型
 * @param selector CSSセレクタ
 * @param parent 親要素（省略時はdocument）
 * @returns {T[]} 見つかった要素の配列。例外時は空配列
 * @example
 *   const items = safeQueryAll<HTMLLIElement>('li');
 */
function safeQueryAll(selector, parent = document) {
    try {
        return Array.from(parent.querySelectorAll(selector));
    }
    catch (e) {
        console.warn('safeQueryAll error:', e, selector, parent);
        return [];
    }
}
/**
 * 要素を安全に生成する。
 *
 * @template K タグ名
 * @param tagName タグ名
 * @returns {HTMLElementTagNameMap[K] | null} 生成した要素、またはnull
 * @example
 *   const div = safeCreateElement('div');
 */
function safeCreateElement(tagName) {
    try {
        return document.createElement(tagName);
    }
    catch (e) {
        console.warn('safeCreateElement error:', e, tagName);
        return null;
    }
}
/**
 * 親要素に子要素を安全に追加する。
 *
 * @param parent 親ノード
 * @param child 子ノード
 * @returns {boolean} 追加成功時true、失敗時false
 * @example
 *   safeAppend(parent, child);
 */
function safeAppend(parent, child) {
    if (!parent || !child)
        return false;
    try {
        parent.appendChild(child);
        return true;
    }
    catch (e) {
        console.warn('safeAppend error:', e, parent, child);
        return false;
    }
}
/**
 * 親要素の先頭に子要素を安全に挿入。失敗時はfalse。
 */
function safePrepend(parent, child) {
    if (!parent || !child)
        return false;
    try {
        parent.insertBefore(child, parent.firstChild);
        return true;
    }
    catch (e) {
        console.warn('safePrepend error:', e, parent, child);
        return false;
    }
}
/**
 * 要素の属性を安全に取得。失敗時は空文字列。
 */
function safeGetAttr(el, attr) {
    if (!el)
        return '';
    try {
        return el.getAttribute(attr) || '';
    }
    catch (e) {
        console.warn('safeGetAttr error:', e, el, attr);
        return '';
    }
}
/**
 * 要素の属性を安全に設定。失敗時はfalse。
 */
function safeSetAttr(el, attr, value) {
    if (!el)
        return false;
    try {
        el.setAttribute(attr, value);
        return true;
    }
    catch (e) {
        console.warn('safeSetAttr error:', e, el, attr, value);
        return false;
    }
}
// 必要に応じて他のDOM操作ラッパーも追加可能


/***/ }),

/***/ "./src/common/utils.ts":
/*!*****************************!*\
  !*** ./src/common/utils.ts ***!
  \*****************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isNullOrEmpty: () => (/* binding */ isNullOrEmpty),
/* harmony export */   randomInt: () => (/* binding */ randomInt),
/* harmony export */   sleep: () => (/* binding */ sleep)
/* harmony export */ });
/**
 * 共通ユーティリティ関数集
 *
 * - アプリ全体でimportして使える汎用関数をまとめています。
 * - 非同期待機・ランダム整数生成・null/空判定など、どのレイヤーからも利用可能です。
 * - 新たな共通処理はこのファイルに追加してください。
 */
/**
 * 指定秒数だけ非同期で待機する。
 *
 * @param seconds 待機する秒数
 * @returns Promise<void> 指定秒数後に解決するPromise
 * @example
 *   await sleep(2); // 2秒待機
 */
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}
/**
 * 指定範囲内のランダム整数を返す。
 *
 * @param min 最小値（含む）
 * @param max 最大値（含む）
 * @returns {number} min以上max以下のランダム整数
 * @example
 *   const n = randomInt(1, 5); // 1〜5のどれか
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
/**
 * null/undefined/空文字列を安全に判定する。
 *
 * @param val 判定対象
 * @returns {boolean} null/undefined/空文字列ならtrue
 * @example
 *   isNullOrEmpty('') // true
 *   isNullOrEmpty(null) // true
 *   isNullOrEmpty('abc') // false
 */
function isNullOrEmpty(val) {
    return val === null || val === undefined || (typeof val === 'string' && val.trim() === '');
}
// 今後も共通化したい関数があればここに追加してください


/***/ }),

/***/ "./src/content/infra/constants.ts":
/*!****************************************!*\
  !*** ./src/content/infra/constants.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CLASS_NAME: () => (/* binding */ CLASS_NAME),
/* harmony export */   CONFIG: () => (/* binding */ CONFIG),
/* harmony export */   ID_NAME: () => (/* binding */ ID_NAME),
/* harmony export */   PageType: () => (/* binding */ PageType),
/* harmony export */   SELECTOR: () => (/* binding */ SELECTOR),
/* harmony export */   WAIT: () => (/* binding */ WAIT)
/* harmony export */ });
/**
 * アプリ全体で利用する定数・設定値の一元管理モジュール。
 *
 * - セレクタ・クラス名・ID名・待機時間などをグループ化して管理します。
 * - どのレイヤーからもimportして利用可能です。
 * - 新たな定数・設定値はこのファイルに追加してください。
 *
 * @example
 *   import { WAIT, SELECTOR, CLASS_NAME, ID_NAME } from '../infra/constants';
 */
// =============================
// 定数・設定値 一元管理モジュール
// =============================
/**
 * 各種待機時間（秒）
 */
const WAIT = {
    BASE_SECONDS: 60, // 標準待機秒数
    EXTRA_MIN: 10, // 追加待機の最小値（秒）
    EXTRA_MAX: 45, // 追加待機の最大値（秒）
};
/**
 * DOM要素セレクタ定数
 */
const SELECTOR = {
    // ページ構造セレクタ
    ROOT_CONTAINER: '#__next',
    MYPAGE_MAIN: '#__next main',
    // 下書き関連
    DRAFTS_LIST_DIV: 'div[data-testid="drafts-list"]',
    DRAFT_LIST: 'ul[data-testid="drafts-item-list"]',
    DRAFT_ITEM: 'a[data-testid="draft-item"]',
    // 出品中商品関連
    ITEMS_LIST: 'ul[data-testid="listed-item-list"]',
    ITEM_LIST_ITEM: 'li',
    ITEM_LINK: 'a[data-testid="listed-item"]',
    // ボタン・ラベル
    RELIST_BUTTON: '#clone-item',
    ITEM_LABEL: '[data-testid="item-label"]',
};
/**
 * 要素ID定数
 */
const ID_NAME = {
    // ボタン・コントロール
    BULK_RELIST_BTN: 'bulk-relist-btn',
    BULK_COUNT_SPAN: 'bulk-selected-count',
    BULK_PROCESSING_SPAN: 'bulk-processing',
    BULK_ORDER_SPAN: 'bulk-order-span',
    // 下書き関連UI
    BULK_PUBLISH_BAR: 'bulk-publish-bar',
    BULK_PUBLISH_BTN: 'bulk-publish-btn',
    // UI要素
    TOAST: 'toast-notification',
    CONFIRM_DIALOG: 'confirm-dialog',
};
/**
 * CSS クラス名定数
 */
const CLASS_NAME = {
    BULK_CHECKBOX: 'bulk-checkbox',
    BULK_ORDER_SPAN: 'bulk-order-span',
    SELECTED_ITEM: 'selected-item',
    DRAFT_ORDER: 'draft-order',
};
/**
 * 設定値定数
 */
const CONFIG = {
    // タイミング設定
    DEBOUNCE_INTERVAL: 300, // ms
    RELIST_WAIT_BASE: 120000, // ms
    RELIST_WAIT_RANDOM: 10000, // ms
    TOAST_DURATION: 3000, // ms
    // UI設定
    ZINDEX: {
        TOAST: 10000,
        CONTROL_PANEL: 9999,
    },
};
/**
 * ページタイプ定数
 */
var PageType;
(function (PageType) {
    PageType["DRAFTS"] = "drafts";
    PageType["LISTINGS"] = "listings";
    PageType["UNKNOWN"] = "unknown";
})(PageType || (PageType = {}));


/***/ }),

/***/ "./src/content/infra/logger.ts":
/*!*************************************!*\
  !*** ./src/content/infra/logger.ts ***!
  \*************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LogLevel: () => (/* binding */ LogLevel),
/* harmony export */   debug: () => (/* binding */ debug),
/* harmony export */   error: () => (/* binding */ error),
/* harmony export */   info: () => (/* binding */ info),
/* harmony export */   log: () => (/* binding */ log),
/* harmony export */   setLogLevel: () => (/* binding */ setLogLevel),
/* harmony export */   warn: () => (/* binding */ warn)
/* harmony export */ });
/**
 * ログ出力・警告出力を担うシンプルなラッパーモジュール。
 *
 * - デバッグ・エラー調査用途で利用します。
 * - すべてのログに拡張機能名のプレフィックスが自動付与されます。
 * - どのレイヤーからもimportして利用可能です。
 *
 * @example
 *   log('初期化完了', obj);
 *   warn('異常値検出', value);
 */
const LOG_PREFIX = '[Mercari Draft Publisher]';
/**
 * ログレベル定義
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["LOG"] = 1] = "LOG";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["WARN"] = 3] = "WARN";
    LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
})(LogLevel || (LogLevel = {}));
// 現在のログレベル（環境に応じて変更可能）
let currentLogLevel = LogLevel.LOG;
/**
 * ログレベルを設定
 * @param level 設定するログレベル
 */
function setLogLevel(level) {
    currentLogLevel = level;
}
/**
 * タイムスタンプ付きメッセージを取得
 * @param message ログメッセージ
 * @returns タイムスタンプ付きメッセージ
 */
function getTimestampedMessage(message) {
    const now = new Date();
    // 標準のDateTimeFormatOptionsを使用
    const timeStr = now.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    // ミリ秒を手動で追加
    const ms = now.getMilliseconds().toString().padStart(3, '0');
    const timestamp = `${timeStr}.${ms}`;
    return `${LOG_PREFIX} [${timestamp}] ${message}`;
}
/**
 * デバッグログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
function debug(message, ...optionalParams) {
    if (currentLogLevel <= LogLevel.DEBUG) {
        console.debug(getTimestampedMessage(`[DEBUG] ${message}`), ...optionalParams);
    }
}
/**
 * 通常ログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
function log(message, ...optionalParams) {
    if (currentLogLevel <= LogLevel.LOG) {
        console.log(getTimestampedMessage(`[LOG] ${message}`), ...optionalParams);
    }
}
/**
 * 情報ログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
function info(message, ...optionalParams) {
    if (currentLogLevel <= LogLevel.INFO) {
        console.info(getTimestampedMessage(`[INFO] ${message}`), ...optionalParams);
    }
}
/**
 * 警告ログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
function warn(message, ...optionalParams) {
    if (currentLogLevel <= LogLevel.WARN) {
        console.warn(getTimestampedMessage(`[WARN] ${message}`), ...optionalParams);
    }
}
/**
 * エラーログ出力
 * @param message ログメッセージ
 * @param optionalParams 追加パラメータ
 */
function error(message, ...optionalParams) {
    if (currentLogLevel <= LogLevel.ERROR) {
        console.error(getTimestampedMessage(`[ERROR] ${message}`), ...optionalParams);
    }
}


/***/ }),

/***/ "./src/content/infra/page-detector.ts":
/*!********************************************!*\
  !*** ./src/content/infra/page-detector.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   detectCurrentPage: () => (/* binding */ detectCurrentPage),
/* harmony export */   isPageType: () => (/* binding */ isPageType)
/* harmony export */ });
/* harmony import */ var _constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./constants */ "./src/content/infra/constants.ts");

/**
 * 現在のページタイプを検出
 * @returns 検出されたページタイプ
 */
function detectCurrentPage() {
    const { pathname } = window.location;
    if (pathname.startsWith('/mypage/drafts')) {
        return _constants__WEBPACK_IMPORTED_MODULE_0__.PageType.DRAFTS;
    }
    if (pathname.startsWith('/mypage/listings')) {
        return _constants__WEBPACK_IMPORTED_MODULE_0__.PageType.LISTINGS;
    }
    return _constants__WEBPACK_IMPORTED_MODULE_0__.PageType.UNKNOWN;
}
/**
 * 特定のページタイプかどうかを判定
 * @param pageType 判定するページタイプ
 * @returns ページタイプが一致するか
 */
function isPageType(pageType) {
    return detectCurrentPage() === pageType;
}


/***/ }),

/***/ "./src/content/logic/app-initializer.ts":
/*!**********************************************!*\
  !*** ./src/content/logic/app-initializer.ts ***!
  \**********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AppInitializer: () => (/* binding */ AppInitializer),
/* harmony export */   appInitializer: () => (/* binding */ appInitializer)
/* harmony export */ });
/* harmony import */ var _infra_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/logger */ "./src/content/infra/logger.ts");
/* harmony import */ var _selection_manager__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./selection-manager */ "./src/content/logic/selection-manager.ts");
/* harmony import */ var _observer_manager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./observer-manager */ "./src/content/logic/observer-manager.ts");
/* harmony import */ var _relist_manager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./relist-manager */ "./src/content/logic/relist-manager.ts");
/* harmony import */ var _ui_ui_manager__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../ui/ui-manager */ "./src/content/ui/ui-manager.ts");
/* harmony import */ var _ui_bulk_bar__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../ui/bulk-bar */ "./src/content/ui/bulk-bar.ts");
/* harmony import */ var _infra_page_detector__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../infra/page-detector */ "./src/content/infra/page-detector.ts");
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _common_dom__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../../common/dom */ "./src/common/dom.ts");









/**
 * アプリケーション初期化とメインロジックの統合
 */
class AppInitializer {
    /**
     * アプリケーションを初期化する
     */
    initialize() {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.log)('アプリケーションを初期化しています');
        // DOM監視開始
        _observer_manager__WEBPACK_IMPORTED_MODULE_2__.observerManager.startObserving();
        // 再出品ボタンのイベント設定
        this.setupRelistButton();
        // DOM読み込み完了時の初期化
        this.setupDomLoadedEvent();
    }
    /**
     * 再出品ボタンのセットアップ
     */
    setupRelistButton() {
        (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_5__.createBulkRelistButton)(async () => {
            const selectedIds = _selection_manager__WEBPACK_IMPORTED_MODULE_1__.selectionManager.getSelections();
            try {
                await _relist_manager__WEBPACK_IMPORTED_MODULE_3__.relistManager.executeRelist(selectedIds);
            }
            catch (error) {
                (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.warn)('再出品処理中にエラーが発生しました', error);
            }
        });
    }
    /**
     * DOM読み込み完了イベントのセットアップ
     */
    setupDomLoadedEvent() {
        window.addEventListener('DOMContentLoaded', () => {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.log)('DOMContentLoaded event fired');
            try {
                // ページタイプに応じてUIを初期化
                const pageType = (0,_infra_page_detector__WEBPACK_IMPORTED_MODULE_6__.detectCurrentPage)();
                if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_7__.PageType.DRAFTS) {
                    // 下書きページの処理
                    const ul = (0,_common_dom__WEBPACK_IMPORTED_MODULE_8__.safeQuery)(_infra_constants__WEBPACK_IMPORTED_MODULE_7__.SELECTOR.DRAFT_LIST);
                    if (ul instanceof HTMLUListElement) {
                        (0,_ui_ui_manager__WEBPACK_IMPORTED_MODULE_4__.renderUiComponents)(ul);
                    }
                }
                else if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_7__.PageType.LISTINGS) {
                    // 出品中ページの処理
                    const ul = (0,_common_dom__WEBPACK_IMPORTED_MODULE_8__.safeQuery)(_infra_constants__WEBPACK_IMPORTED_MODULE_7__.SELECTOR.ITEMS_LIST);
                    if (ul instanceof HTMLUListElement) {
                        (0,_ui_ui_manager__WEBPACK_IMPORTED_MODULE_4__.renderUiComponents)(ul);
                    }
                }
            }
            catch (e) {
                (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.warn)('初期化処理中にエラーが発生しました', e);
            }
        });
    }
}
// シングルトンインスタンス
const appInitializer = new AppInitializer();


/***/ }),

/***/ "./src/content/logic/dom-utils.ts":
/*!****************************************!*\
  !*** ./src/content/logic/dom-utils.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   findLiByItemId: () => (/* binding */ findLiByItemId),
/* harmony export */   getItemIdFromLi: () => (/* binding */ getItemIdFromLi),
/* harmony export */   getItemName: () => (/* binding */ getItemName),
/* harmony export */   getRelistButton: () => (/* binding */ getRelistButton)
/* harmony export */ });
/**
 * DOM操作のユーティリティ関数群
 * - 要素取得
 * - 属性抽出
 */
/**
 * li要素からitemIdを取得
 * @param li li要素
 * @returns itemId文字列 or null
 */
function getItemIdFromLi(li) {
    const cb = li.querySelector('.bulk-checkbox');
    if (!(cb instanceof HTMLInputElement))
        return null;
    return cb.dataset.itemId ?? null;
}
/**
 * li要素から再出品ボタンを取得
 * @param li li要素
 * @returns 再出品ボタン or null
 */
function getRelistButton(li) {
    const btn = li.querySelector('#clone-item');
    return btn instanceof HTMLButtonElement ? btn : null;
}
/**
 * li要素から商品名を取得
 * @param li li要素
 * @returns 商品名文字列
 */
function getItemName(li) {
    const labelElem = li.querySelector('[data-testid="item-label"]');
    return labelElem instanceof HTMLElement ? (labelElem.textContent?.trim() ?? '') : '';
}
/**
 * ul内からitemIdに一致するli要素を検索
 * @param ul 商品リストul
 * @param id itemId
 * @returns 一致するli要素 or undefined
 */
function findLiByItemId(ul, id) {
    return Array.from(ul.querySelectorAll('li')).find(li => getItemIdFromLi(li) === id);
}


/***/ }),

/***/ "./src/content/logic/observer-manager.ts":
/*!***********************************************!*\
  !*** ./src/content/logic/observer-manager.ts ***!
  \***********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ObserverManager: () => (/* binding */ ObserverManager),
/* harmony export */   observerManager: () => (/* binding */ observerManager)
/* harmony export */ });
/* harmony import */ var _infra_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/logger */ "./src/content/infra/logger.ts");
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _ui_ui_manager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../ui/ui-manager */ "./src/content/ui/ui-manager.ts");



/**
 * DOM変更監視を担当するモジュール
 * - MutationObserverの管理
 * - 要素変更検出とイベント発火
 */
class ObserverManager {
    constructor() {
        this.lastUl = null;
        this.relistTimeout = null;
        this.ulObserver = null;
        this.liObserver = null;
    }
    disconnectObservers() {
        this.ulObserver?.disconnect();
        this.liObserver?.disconnect();
        this.ulObserver = null;
        this.liObserver = null;
        if (this.relistTimeout) {
            clearTimeout(this.relistTimeout);
            this.relistTimeout = null;
        }
    }
    startObserving() {
        const nextDiv = document.getElementById('__next');
        if (!(nextDiv instanceof HTMLElement)) {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.warn)('#__next not found');
            return;
        }
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.log)('#__next found, start observing');
        this.disconnectObservers();
        this.ulObserver = new MutationObserver(() => {
            const ul = nextDiv.querySelector(_infra_constants__WEBPACK_IMPORTED_MODULE_1__.SELECTOR.ITEMS_LIST);
            if (!(ul instanceof HTMLUListElement))
                return;
            if (ul !== this.lastUl) {
                this.lastUl = ul;
                (0,_ui_ui_manager__WEBPACK_IMPORTED_MODULE_2__.renderUiComponents)(ul);
                // liの追加削除監視
                this.liObserver?.disconnect();
                this.liObserver = new MutationObserver(() => {
                    if (this.relistTimeout)
                        clearTimeout(this.relistTimeout);
                    this.relistTimeout = window.setTimeout(() => {
                        (0,_ui_ui_manager__WEBPACK_IMPORTED_MODULE_2__.renderUiComponents)(ul);
                    }, 300);
                });
                this.liObserver.observe(ul, { childList: true, subtree: false });
            }
        });
        this.ulObserver.observe(nextDiv, { childList: true, subtree: true });
    }
}
// シングルトンインスタンス
const observerManager = new ObserverManager();


/***/ }),

/***/ "./src/content/logic/publisher.ts":
/*!****************************************!*\
  !*** ./src/content/logic/publisher.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initializePublisherUI: () => (/* binding */ initializePublisherUI),
/* harmony export */   publishAllDrafts: () => (/* binding */ publishAllDrafts)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _common_utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../common/utils */ "./src/common/utils.ts");
/* harmony import */ var _ui_list__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../ui/list */ "./src/content/ui/list.ts");
/* harmony import */ var _common_dom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../common/dom */ "./src/common/dom.ts");
/* harmony import */ var _infra_logger__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../infra/logger */ "./src/content/infra/logger.ts");
/* harmony import */ var _selection_manager__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./selection-manager */ "./src/content/logic/selection-manager.ts");
/* harmony import */ var _ui_checkbox_manager__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../ui/checkbox-manager */ "./src/content/ui/checkbox-manager.ts");
/* harmony import */ var _ui_order_display__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../ui/order-display */ "./src/content/ui/order-display.ts");
/* harmony import */ var _ui_bulk_bar__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ../ui/bulk-bar */ "./src/content/ui/bulk-bar.ts");









/**
 * 指定idの下書きli要素を探し、出品ボタンをクリックする。
 *
 * - 見つからない場合は警告を表示します。
 * - ページ構造変更時の堅牢性も考慮。
 *
 * @param id 下書き商品のid
 * @returns 出品クリック成功時true、失敗時false
 */
async function publishDraftItem(id) {
    const item = (0,_ui_list__WEBPACK_IMPORTED_MODULE_2__.findDraftItemById)(id);
    // 商品名取得（itemがnullの場合は空文字）
    let itemName = '';
    if (item && item.li) {
        const labelElem = (0,_common_dom__WEBPACK_IMPORTED_MODULE_3__.safeQuery)('[data-testid="item-label"]', item.li);
        itemName = labelElem ? labelElem.textContent?.trim() ?? '' : '';
    }
    if (!item) {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.warn)(`li not found for id: ${id} 商品名: ${itemName}`);
        alert(`下書き商品の要素が見つかりません (id: ${id}) 商品名: ${itemName}。ページ構造が変更された可能性があります。`);
        return false;
    }
    const submitBtn = (0,_common_dom__WEBPACK_IMPORTED_MODULE_3__.safeQuery)('button[id="submit-draft"]', item.li);
    (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)('[DEBUG] submitBtn:', submitBtn, 'item:', item, 'id:', id, '商品名:', itemName);
    if (submitBtn instanceof HTMLButtonElement) {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)('[DEBUG] submitBtn type:', submitBtn.type, 'form:', submitBtn.form);
        if (submitBtn.form) {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)('[DEBUG] submitBtn.form:', submitBtn.form, 'form action:', submitBtn.form.action, 'method:', submitBtn.form.method);
        }
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)('[DEBUG] before click, submitBtn.disabled:', submitBtn.disabled, 'hidden:', submitBtn.hidden, 'display:', submitBtn.style.display);
        submitBtn.addEventListener('click', (e) => {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)('[DEBUG] submitBtn click event fired', e);
        }, { once: true });
        submitBtn.click();
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)(`出品ボタンをクリック: ${id} 商品名: ${itemName}`);
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)('[DEBUG] after click, submitBtn.disabled:', submitBtn.disabled, 'hidden:', submitBtn.hidden, 'display:', submitBtn.style.display);
        return true;
    }
    else {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.warn)(`出品ボタンが見つかりません: ${id} 商品名: ${itemName}`);
        alert(`出品ボタンが見つかりません (id: ${id}) 商品名: ${itemName}。ページ構造が変更された可能性があります。`);
        return false;
    }
}
/**
 * 複数idの下書き商品を順番に出品し、各出品間でランダム待機を挟む。
 *
 * - 1件ずつpublishDraftItemを呼び、各出品間でランダムな待機を入れます。
 *
 * @param ids 出品対象のid配列
 * @returns Promise<void>
 */
async function publishAllDrafts(ids) {
    for (let i = 0; i < ids.length; i++) {
        await publishDraftItem(ids[i]);
        const extra = (0,_common_utils__WEBPACK_IMPORTED_MODULE_1__.randomInt)(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.WAIT.EXTRA_MIN, _infra_constants__WEBPACK_IMPORTED_MODULE_0__.WAIT.EXTRA_MAX);
        const wait = _infra_constants__WEBPACK_IMPORTED_MODULE_0__.WAIT.BASE_SECONDS + extra;
        if (i < ids.length - 1) {
            await (0,_common_utils__WEBPACK_IMPORTED_MODULE_1__.sleep)(wait);
        }
    }
}
/**
 * draftListの存在チェック・UI挿入・イベント登録を統括するエントリ関数。
 *
 * - UI初期化時のエントリポイントです。
 * - draftListがなければ警告を表示し、既にバーが存在する場合は何もしません。
 * @example
 *   initializePublisherUI();
 */
function initializePublisherUI() {
    const draftList = (0,_ui_list__WEBPACK_IMPORTED_MODULE_2__.getDraftList)();
    if (!(draftList instanceof HTMLUListElement)) {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.warn)('draftList not found');
        alert('下書きリストが見つかりません。ページを再読み込みしてください。');
        return;
    }
    const items = (0,_ui_list__WEBPACK_IMPORTED_MODULE_2__.getDraftItems)();
    (0,_infra_logger__WEBPACK_IMPORTED_MODULE_4__.log)(`draftList found, li count: ${items.length}`);
    const updateOrderFn = () => (0,_ui_order_display__WEBPACK_IMPORTED_MODULE_7__.updateOrderDisplay)(items, _selection_manager__WEBPACK_IMPORTED_MODULE_5__.selectionManager);
    // UI初期化
    (0,_ui_checkbox_manager__WEBPACK_IMPORTED_MODULE_6__.renderCheckboxes)(draftList, updateOrderFn);
    (0,_ui_order_display__WEBPACK_IMPORTED_MODULE_7__.updateOrderDisplay)(items, _selection_manager__WEBPACK_IMPORTED_MODULE_5__.selectionManager);
    (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_8__.setupBulkBar)(draftList, _selection_manager__WEBPACK_IMPORTED_MODULE_5__.selectionManager, () => {
        updateOrderFn();
        (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_8__.updateDraftCount)(_selection_manager__WEBPACK_IMPORTED_MODULE_5__.selectionManager.getCount(), items.length);
    });
    // 初期カウント表示
    (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_8__.updateDraftCount)(_selection_manager__WEBPACK_IMPORTED_MODULE_5__.selectionManager.getCount(), items.length);
}


/***/ }),

/***/ "./src/content/logic/relist-manager.ts":
/*!*********************************************!*\
  !*** ./src/content/logic/relist-manager.ts ***!
  \*********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RelistManager: () => (/* binding */ RelistManager),
/* harmony export */   relistManager: () => (/* binding */ relistManager)
/* harmony export */ });
/* harmony import */ var _infra_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/logger */ "./src/content/infra/logger.ts");
/* harmony import */ var _ui_bulk_bar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../ui/bulk-bar */ "./src/content/ui/bulk-bar.ts");
/* harmony import */ var _logic_dom_utils__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../logic/dom-utils */ "./src/content/logic/dom-utils.ts");



/**
 * 再出品処理を担当するモジュール
 * - 再出品ボタンのクリック
 * - 処理状況の管理
 */
class RelistManager {
    /**
     * 商品の一括再出品を実行
     * @param ids 再出品する商品ID配列
     * @returns 処理結果のPromise
     */
    async executeRelist(ids) {
        if (ids.length === 0) {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.warn)('再出品対象の商品が選択されていません');
            return false;
        }
        const ul = document.querySelector('ul[data-testid="listed-item-list"]');
        if (!ul) {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.warn)('商品リストが見つかりません');
            return false;
        }
        (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_1__.renderProcessingSpan)('処理中...');
        let success = true;
        const total = ids.length;
        for (let i = 0; i < total; i++) {
            const id = ids[i];
            (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_1__.renderProcessingSpan)(`処理中... (${i + 1}/${total})`);
            try {
                await this.relistSingleItem(id, ul);
            }
            catch (error) {
                (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.warn)(`商品ID: ${id} の再出品に失敗しました`, error);
                success = false;
            }
        }
        (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_1__.renderProcessingSpan)('処理中... (完了)');
        setTimeout(() => {
            (0,_ui_bulk_bar__WEBPACK_IMPORTED_MODULE_1__.renderProcessingSpan)('');
        }, 1500);
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.log)('再出品処理が完了しました');
        return success;
    }
    /**
     * 単一商品の再出品処理
     * @param id 商品ID
     * @param ul 商品リスト要素
     */
    async relistSingleItem(id, ul) {
        const li = (0,_logic_dom_utils__WEBPACK_IMPORTED_MODULE_2__.findLiByItemId)(ul, id);
        if (!li) {
            throw new Error(`商品ID: ${id} のリスト要素が見つかりません`);
        }
        const relistBtn = (0,_logic_dom_utils__WEBPACK_IMPORTED_MODULE_2__.getRelistButton)(li);
        if (!relistBtn) {
            throw new Error(`商品ID: ${id} の再出品ボタンが見つかりません`);
        }
        const itemName = (0,_logic_dom_utils__WEBPACK_IMPORTED_MODULE_2__.getItemName)(li);
        const now = new Date();
        const timeStr = now.toLocaleString();
        const rawId = id.replace(/^\/item\//, '');
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_0__.log)(`[再出品] ${timeStr} 商品: ${itemName} (id: ${rawId})`);
        relistBtn.click();
        // 再出品後の待機
        const waitMs = 120000 + Math.floor(Math.random() * 10000);
        await new Promise(res => setTimeout(res, waitMs));
    }
}
// シングルトンインスタンス
const relistManager = new RelistManager();


/***/ }),

/***/ "./src/content/logic/selection-manager.ts":
/*!************************************************!*\
  !*** ./src/content/logic/selection-manager.ts ***!
  \************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SelectionManager: () => (/* binding */ SelectionManager),
/* harmony export */   selectionManager: () => (/* binding */ selectionManager)
/* harmony export */ });
/**
 * 選択商品の管理を担当するモジュール
 * - 選択順の管理
 * - 選択状態の追加/削除
 */
class SelectionManager {
    constructor() {
        this.selectionOrder = [];
    }
    /**
     * idを選択リストに追加
     */
    addSelection(id) {
        if (!this.selectionOrder.includes(id)) {
            this.selectionOrder.push(id);
        }
    }
    /**
     * idを選択リストから削除
     */
    removeSelection(id) {
        this.selectionOrder = this.selectionOrder.filter(x => x !== id);
    }
    /**
     * 全選択解除
     */
    clearSelection() {
        this.selectionOrder = [];
    }
    /**
     * 選択中id一覧を取得
     */
    getSelections() {
        return [...this.selectionOrder];
    }
    /**
     * 選択中id一覧を取得 (DraftSelectionとの互換性用)
     */
    getAll() {
        return this.getSelections();
    }
    /**
     * 選択数を取得
     */
    getCount() {
        return this.selectionOrder.length;
    }
    /**
     * idの選択順序（インデックス）を取得
     */
    getOrderIndex(id) {
        return this.selectionOrder.indexOf(id);
    }
}
// シングルトンインスタンス
const selectionManager = new SelectionManager();


/***/ }),

/***/ "./src/content/ui/bulk-bar.ts":
/*!************************************!*\
  !*** ./src/content/ui/bulk-bar.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createBulkCheckbox: () => (/* binding */ createBulkCheckbox),
/* harmony export */   createBulkPublishBar: () => (/* binding */ createBulkPublishBar),
/* harmony export */   createBulkRelistButton: () => (/* binding */ createBulkRelistButton),
/* harmony export */   createPageTypeBar: () => (/* binding */ createPageTypeBar),
/* harmony export */   initializePageUI: () => (/* binding */ initializePageUI),
/* harmony export */   renderBulkBar: () => (/* binding */ renderBulkBar),
/* harmony export */   renderCountSpan: () => (/* binding */ renderCountSpan),
/* harmony export */   renderProcessingSpan: () => (/* binding */ renderProcessingSpan),
/* harmony export */   setupBulkBar: () => (/* binding */ setupBulkBar),
/* harmony export */   updateDraftCount: () => (/* binding */ updateDraftCount)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _infra_logger__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../infra/logger */ "./src/content/infra/logger.ts");
/* harmony import */ var _logic_publisher__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../logic/publisher */ "./src/content/logic/publisher.ts");
/* harmony import */ var _common_dom__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../../common/dom */ "./src/common/dom.ts");
/* harmony import */ var _infra_page_detector__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../infra/page-detector */ "./src/content/infra/page-detector.ts");





/**
 * 既存のUI要素を取得または新規作成
 * @param id 要素ID
 * @param tagName 要素のタグ名
 * @returns 取得または作成した要素
 */
function getOrCreateElement(id, tagName) {
    let element = document.getElementById(id);
    if (element && element.tagName === tagName.toUpperCase()) {
        return element;
    }
    element = document.createElement(tagName);
    element.id = id;
    return element;
}
/**
 * 一括出品バー要素を生成
 *
 * - 下書きリスト上部に挿入する一括出品バーdivを生成します。
 * - ボタンIDやスタイルも一括で付与されます。
 *
 * @returns {HTMLDivElement} 生成したバーdiv要素
 * @throws DOM生成に失敗した場合
 * @example
 *   const bar = createBulkPublishBar();
 */
function createBulkPublishBar() {
    const bar = (0,_common_dom__WEBPACK_IMPORTED_MODULE_3__.safeCreateElement)('div');
    if (!bar)
        throw new Error('Failed to create bulk publish bar');
    bar.id = _infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_PUBLISH_BAR;
    bar.style.position = 'sticky';
    bar.style.top = '0';
    bar.style.background = '#fff';
    bar.style.zIndex = '1000';
    bar.style.padding = '8px';
    bar.style.borderBottom = '1px solid #eee';
    // 件数表示用span追加
    bar.innerHTML = `
    <button id="${_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_PUBLISH_BTN}">選択した下書きを順番に出品</button>
    <span id="draft-count" style="margin-left: 12px; font-weight: bold;">選択件数: 0</span>
    <span id="draft-total" style="margin-left: 12px;">全件数: 0</span>
  `;
    return bar;
}
/**
 * アイテム用チェックボックスを作成
 */
function createBulkCheckbox(li, onChange) {
    if (li.querySelector('.bulk-checkbox'))
        return;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'bulk-checkbox';
    checkbox.style.marginRight = '8px';
    const aTag = li.querySelector('a[data-testid="listed-item"]');
    if (aTag) {
        const itemId = aTag.getAttribute('href') || '';
        checkbox.dataset.itemId = itemId;
    }
    checkbox.addEventListener('change', () => {
        const id = checkbox.dataset.itemId;
        onChange(id, checkbox.checked);
    });
    li.insertBefore(checkbox, li.firstChild);
}
/**
 * スタイルを適用するヘルパー関数
 * @param element 対象要素
 * @param styles 適用するスタイル
 */
function applyFixedStyles(element, styles) {
    Object.entries(styles).forEach(([key, value]) => {
        element.style[key] = value;
    });
}
/**
 * 件数表示用spanを生成・更新
 * @param count 選択件数
 * @returns 生成したspan要素
 */
function renderCountSpan(count) {
    const countSpan = getOrCreateElement(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_COUNT_SPAN, 'span');
    countSpan.textContent = `選択中: ${count}件`;
    applyFixedStyles(countSpan, {
        position: 'fixed',
        top: '80px',
        right: '240px',
        zIndex: '9999',
        fontWeight: 'bold',
        color: '#333',
        background: '#fffbe6',
        padding: '6px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
    });
    if (!countSpan.isConnected) {
        document.body.appendChild(countSpan);
    }
    return countSpan;
}
/**
 * 処理中表示用spanを生成・更新
 * @param text 表示テキスト
 * @returns 生成したspan要素
 */
function renderProcessingSpan(text) {
    const processingSpan = getOrCreateElement(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_PROCESSING_SPAN, 'span');
    processingSpan.textContent = text;
    applyFixedStyles(processingSpan, {
        position: 'fixed',
        top: '120px',
        right: '40px',
        zIndex: '9999',
        fontWeight: 'bold',
        color: '#d32f2f',
        background: '#fffbe6',
        padding: '6px 12px',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        display: text ? 'inline' : 'none'
    });
    if (!processingSpan.isConnected) {
        document.body.appendChild(processingSpan);
    }
    return processingSpan;
}
/**
 * 一括再出品ボタンを生成
 * @param onClick クリック時のコールバック
 * @returns 生成したボタン要素
 */
function createBulkRelistButton(onClick) {
    const bulkBtn = getOrCreateElement(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_RELIST_BTN, 'button');
    bulkBtn.textContent = '選択した商品を再出品';
    applyFixedStyles(bulkBtn, {
        position: 'fixed',
        top: '80px',
        right: '40px',
        zIndex: '9999',
        padding: '8px 16px',
        background: '#ff9800',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        fontWeight: 'bold',
        cursor: 'pointer'
    });
    bulkBtn.onclick = onClick;
    if (!bulkBtn.isConnected) {
        document.body.appendChild(bulkBtn);
    }
    return bulkBtn;
}
/**
 * 一括出品バーをdraftList直前に挿入する。
 *
 * - UI初期化時に呼び出されます。
 * - 失敗時はnullを返します。
 *
 * @param draftList 対象ul要素
 * @returns 挿入したdiv要素、失敗時null
 */
function insertBulkPublishBar(draftList) {
    if (!draftList || !draftList.parentNode) {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_1__.warn)('draftList or its parentNode not found');
        alert('下書きリストまたはその親要素が見つかりません。ページ構造が変更された可能性があります。');
        return null;
    }
    const bar = createBulkPublishBar();
    try {
        draftList.parentNode.insertBefore(bar, draftList);
        return bar;
    }
    catch (e) {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_1__.warn)('insertBefore failed', e);
        alert('下書きリストの親要素へのバー挿入に失敗しました。');
        return null;
    }
}
/**
 * 件数表示用spanのテキストを更新する
 *
 * - 一括出品バーの「選択件数: n」「全件数: m」表示を更新します。
 * - draft-count, draft-totalというIDのspan要素が存在する場合のみ反映されます。
 *
 * @param selectedCount 現在選択されている下書き件数
 * @param totalCount 下書き全体の件数
 */
function updateDraftCount(selectedCount, totalCount) {
    const countSpan = document.getElementById('draft-count');
    if (countSpan) {
        countSpan.textContent = `選択件数: ${selectedCount}`;
    }
    const totalSpan = document.getElementById('draft-total');
    if (totalSpan) {
        totalSpan.textContent = `全件数: ${totalCount}`;
    }
}
/**
 * 一括再出品バーを描画
 * @param selectedCount 選択された商品数
 */
function renderBulkBar(selectedCount) {
    renderCountSpan(selectedCount);
}
/**
 * UI初期化: バルクバーのセットアップ
 */
function setupBulkBar(draftList, selection, // インターフェースに変更
updateCallback) {
    if (document.getElementById(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_PUBLISH_BAR))
        return;
    const bar = insertBulkPublishBar(draftList);
    if (!bar)
        return;
    setupBulkPublishButton(selection, updateCallback);
    (0,_infra_logger__WEBPACK_IMPORTED_MODULE_1__.log)('Bulk publish bar initialized');
}
/**
 * 一括出品ボタンにクリックイベントを登録。
 *
 * - 選択チェック・確認ダイアログ・出品処理本体を呼び出します。
 * - UI初期化時に呼び出してください。
 *
 * @param selection 選択管理インターフェース
 * @param updateOrderFn 出品後の順番更新コールバック
 */
function setupBulkPublishButton(selection, // インターフェースに変更
updateOrderFn) {
    const btn = document.getElementById(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_PUBLISH_BTN);
    if (!(btn instanceof HTMLButtonElement))
        return;
    btn.onclick = async function () {
        if (selection.getCount() === 0) { // length の代わりに getCount() を使用
            alert('下書きを選択してください');
            return;
        }
        if (!confirm('選択した下書きを順番に出品します。よろしいですか？'))
            return;
        const ids = selection.getAll();
        await (0,_logic_publisher__WEBPACK_IMPORTED_MODULE_2__.publishAllDrafts)(ids);
        alert('すべての出品処理が完了しました');
        updateOrderFn();
    };
}
/**
 * ページタイプに応じたバーを生成
 * - 下書きページなら出品バー
 * - 出品中ページなら再出品バー
 */
function createPageTypeBar() {
    const pageType = (0,_infra_page_detector__WEBPACK_IMPORTED_MODULE_4__.detectCurrentPage)();
    if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_0__.PageType.DRAFTS) {
        return createBulkPublishBar();
    }
    else if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_0__.PageType.LISTINGS) {
        // 出品中ページ用のバーも必要なら追加実装
        // 現在は再出品ボタンはfixedポジションで表示
        return null;
    }
    return null;
}
/**
 * UI初期化: ページに応じたUI表示
 * @param ul リスト要素
 */
function initializePageUI(ul) {
    if (!ul)
        return;
    const pageType = (0,_infra_page_detector__WEBPACK_IMPORTED_MODULE_4__.detectCurrentPage)();
    if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_0__.PageType.DRAFTS) {
        // 下書きページの場合、バルクバーを表示
        if (!document.getElementById(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_PUBLISH_BAR)) {
            const bar = createBulkPublishBar();
            if (bar && ul.parentNode) {
                ul.parentNode.insertBefore(bar, ul);
                (0,_infra_logger__WEBPACK_IMPORTED_MODULE_1__.log)('下書き出品バーを初期化しました');
            }
        }
    }
    else if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_0__.PageType.LISTINGS) {
        // 出品中ページの場合、再出品ボタンを表示
        if (!document.getElementById(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.ID_NAME.BULK_RELIST_BTN)) {
            createBulkRelistButton(() => {
                // 再出品ボタンのクリック処理（必要に応じて実装）
                (0,_infra_logger__WEBPACK_IMPORTED_MODULE_1__.log)('再出品ボタンがクリックされました');
            });
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_1__.log)('再出品ボタンを初期化しました');
        }
    }
}


/***/ }),

/***/ "./src/content/ui/checkbox-manager.ts":
/*!********************************************!*\
  !*** ./src/content/ui/checkbox-manager.ts ***!
  \********************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   addCheckboxAndOrderToLi: () => (/* binding */ addCheckboxAndOrderToLi),
/* harmony export */   renderCheckboxes: () => (/* binding */ renderCheckboxes)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _common_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../common/dom */ "./src/common/dom.ts");
/* harmony import */ var _infra_logger__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../infra/logger */ "./src/content/infra/logger.ts");
/* harmony import */ var _logic_selection_manager__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../logic/selection-manager */ "./src/content/logic/selection-manager.ts");
/* harmony import */ var _checkbox__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./checkbox */ "./src/content/ui/checkbox.ts");
/* harmony import */ var _order__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./order */ "./src/content/ui/order.ts");
/* harmony import */ var _list__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./list */ "./src/content/ui/list.ts");
/* harmony import */ var _bulk_bar__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./bulk-bar */ "./src/content/ui/bulk-bar.ts");








/**
 * 指定したDraftItemにチェックボックスと順番表示用spanを追加し、
 * チェック状態の変更でDraftSelectionを更新します。
 *
 * - DraftItem（li要素＋id等の情報）ごとにUI部品を挿入し、選択状態をDraftSelectionで型安全に管理します。
 * - 既にチェックボックスが存在する場合は何もしません。
 *
 * @param item 対象のDraftItem
 * @param selection SelectionManagerインスタンス
 * @param updateOrder 順番表示更新コールバック
 */
function addCheckboxAndOrderToLi(item, updateOrder) {
    const { li } = item;
    if (!li)
        return;
    if ((0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)(`.${_infra_constants__WEBPACK_IMPORTED_MODULE_0__.CLASS_NAME.BULK_CHECKBOX}`, li))
        return;
    const onChange = function (e) {
        const aTag = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.SELECTOR.DRAFT_ITEM, li);
        if (!(aTag instanceof HTMLAnchorElement)) {
            (0,_infra_logger__WEBPACK_IMPORTED_MODULE_2__.warn)('a[data-testid="draft-item"] not found in li:', li);
            alert('下書き商品のリンクが見つかりません。ページ構造が変更された可能性があります。');
            return;
        }
        const itemId = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeGetAttr)(aTag, 'href');
        if (!itemId)
            return;
        if (this.checked) {
            _logic_selection_manager__WEBPACK_IMPORTED_MODULE_3__.selectionManager.addSelection(itemId);
        }
        else {
            _logic_selection_manager__WEBPACK_IMPORTED_MODULE_3__.selectionManager.removeSelection(itemId);
        }
        updateOrder();
        (0,_bulk_bar__WEBPACK_IMPORTED_MODULE_7__.updateDraftCount)(_logic_selection_manager__WEBPACK_IMPORTED_MODULE_3__.selectionManager.getCount(), (0,_list__WEBPACK_IMPORTED_MODULE_6__.getDraftItems)().length);
    };
    const checkbox = (0,_checkbox__WEBPACK_IMPORTED_MODULE_4__.createDraftCheckbox)(onChange);
    const orderSpan = (0,_order__WEBPACK_IMPORTED_MODULE_5__.createOrderSpan)();
    const firstDiv = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)('div', li);
    if (firstDiv) {
        (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safePrepend)(firstDiv, orderSpan);
        (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safePrepend)(firstDiv, checkbox);
    }
    else {
        (0,_infra_logger__WEBPACK_IMPORTED_MODULE_2__.warn)('div not found in li:', li);
        alert('下書き商品の表示領域が見つかりません。ページ構造が変更された可能性があります。');
    }
}
/**
 * 複数li要素にチェックボックス・順番表示を一括追加する。
 *
 * - getDraftItems()で取得したli群に対し、addCheckboxAndOrderToLiを一括適用します。
 *
 * @param ul 下書きリスト要素
 * @param updateOrder 順番表示更新コールバック
 */
function renderCheckboxes(ul, updateOrder) {
    if (!ul)
        return;
    const items = (0,_list__WEBPACK_IMPORTED_MODULE_6__.getDraftItems)();
    items.forEach(item => addCheckboxAndOrderToLi(item, updateOrder));
}


/***/ }),

/***/ "./src/content/ui/checkbox.ts":
/*!************************************!*\
  !*** ./src/content/ui/checkbox.ts ***!
  \************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createDraftCheckbox: () => (/* binding */ createDraftCheckbox)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");

/**
 * チェックボックス要素を生成する
 *
 * @param onChange 変更イベントハンドラ
 * @returns 生成したHTMLInputElement
 */
function createDraftCheckbox(onChange) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = _infra_constants__WEBPACK_IMPORTED_MODULE_0__.CLASS_NAME.BULK_CHECKBOX;
    checkbox.style.marginRight = '8px';
    checkbox.addEventListener('change', function (e) {
        onChange.call(this, e);
    });
    return checkbox;
}


/***/ }),

/***/ "./src/content/ui/list.ts":
/*!********************************!*\
  !*** ./src/content/ui/list.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   findDraftItemById: () => (/* binding */ findDraftItemById),
/* harmony export */   getDraftItems: () => (/* binding */ getDraftItems),
/* harmony export */   getDraftList: () => (/* binding */ getDraftList)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _common_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../common/dom */ "./src/common/dom.ts");


/**
 * 下書きリスト(ul)要素を取得
 *
 * - ページ内の下書きリストul要素を安全に取得します。
 * - 存在しない場合はnullを返します。
 *
 * @returns {HTMLUListElement | null} 下書きリストul要素
 */
function getDraftList() {
    const el = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.SELECTOR.DRAFT_LIST);
    return el instanceof HTMLUListElement ? el : null;
}
/**
 * 下書きリスト内のli要素を取得し、DraftItem型で返す
 *
 * @returns {DraftItem[]} DraftItem型配列
 */
function getDraftItems() {
    const draftList = getDraftList();
    if (!draftList)
        return [];
    // map と filter の部分を修正
    const items = [];
    (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQueryAll)('li', draftList).forEach(li => {
        const anchor = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)(_infra_constants__WEBPACK_IMPORTED_MODULE_0__.SELECTOR.DRAFT_ITEM, li);
        const id = anchor?.getAttribute('href') ?? '';
        if (id) {
            items.push({
                li,
                id,
                anchor: anchor ?? undefined
            });
        }
    });
    return items;
}
/**
 * 指定idの下書きDraftItemを取得
 *
 * @param id 下書き商品のid
 * @returns {DraftItem | undefined} 対象DraftItem
 */
function findDraftItemById(id) {
    return getDraftItems().find(item => item.id === id);
}


/***/ }),

/***/ "./src/content/ui/order-display.ts":
/*!*****************************************!*\
  !*** ./src/content/ui/order-display.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   renderOrderNumbers: () => (/* binding */ renderOrderNumbers),
/* harmony export */   updateOrderDisplay: () => (/* binding */ updateOrderDisplay)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");
/* harmony import */ var _common_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../../common/dom */ "./src/common/dom.ts");


/**
 * SelectionManagerの状態に応じてli内の順番表示を更新する。
 *
 * @param items DraftItem[]
 * @param selection SelectionManagerインスタンス
 */
function updateOrderDisplay(items, selection) {
    items.forEach(item => {
        const { li, id } = item;
        const orderSpan = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)(`.${_infra_constants__WEBPACK_IMPORTED_MODULE_0__.CLASS_NAME.DRAFT_ORDER}`, li);
        if (!(orderSpan instanceof HTMLSpanElement))
            return;
        const idx = selection.getOrderIndex(id);
        orderSpan.textContent = idx >= 0 ? String(idx + 1) : '';
    });
}
/**
 * 下書きリストのすべてのアイテムの順番表示を更新する
 * @param ul HTMLUListElement
 * @param selection SelectionManagerインスタンス
 */
function renderOrderNumbers(ul, selection) {
    if (!ul)
        return;
    const items = Array.from(ul.querySelectorAll('li')).map(li => {
        const aTag = (0,_common_dom__WEBPACK_IMPORTED_MODULE_1__.safeQuery)('a[data-testid="draft-item"]', li);
        const id = aTag?.getAttribute('href') || '';
        return { li, id, anchor: aTag ?? undefined };
    });
    updateOrderDisplay(items, selection);
}


/***/ }),

/***/ "./src/content/ui/order.ts":
/*!*********************************!*\
  !*** ./src/content/ui/order.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   createOrderSpan: () => (/* binding */ createOrderSpan)
/* harmony export */ });
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../infra/constants */ "./src/content/infra/constants.ts");

/**
 * 順番表示用の <span> 要素を生成するユーティリティ関数。
 *
 * - チェックボックス横に表示される「出品順序」用のspanを生成します。
 * - 例外安全なDOM生成ラッパーを利用し、生成失敗時は例外を投げます。
 * - スタイルやクラス名も一括で付与されるため、UI部品として再利用可能です。
 *
 * @returns {HTMLSpanElement} 出品順序表示用のspan要素
 * @throws DOM生成に失敗した場合
 * @example
 *   const span = createOrderSpan();
 *   parent.appendChild(span);
 */
function createOrderSpan() {
    // 出品順序表示用spanを安全に生成
    const orderSpan = document.createElement('span');
    if (!orderSpan)
        throw new Error('Failed to create order span');
    orderSpan.className = _infra_constants__WEBPACK_IMPORTED_MODULE_0__.CLASS_NAME.BULK_ORDER_SPAN;
    orderSpan.style.marginRight = '4px';
    orderSpan.style.fontWeight = 'bold';
    orderSpan.style.color = '#333';
    orderSpan.textContent = '';
    return orderSpan;
}


/***/ }),

/***/ "./src/content/ui/ui-manager.ts":
/*!**************************************!*\
  !*** ./src/content/ui/ui-manager.ts ***!
  \**************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   elementExists: () => (/* binding */ elementExists),
/* harmony export */   getOrCreateElement: () => (/* binding */ getOrCreateElement),
/* harmony export */   renderUiComponents: () => (/* binding */ renderUiComponents)
/* harmony export */ });
/* harmony import */ var _logic_selection_manager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../logic/selection-manager */ "./src/content/logic/selection-manager.ts");
/* harmony import */ var _bulk_bar__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./bulk-bar */ "./src/content/ui/bulk-bar.ts");
/* harmony import */ var _checkbox_manager__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./checkbox-manager */ "./src/content/ui/checkbox-manager.ts");
/* harmony import */ var _order_display__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./order-display */ "./src/content/ui/order-display.ts");
/* harmony import */ var _infra_page_detector__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../infra/page-detector */ "./src/content/infra/page-detector.ts");





/**
 * UI全体の管理と描画を担当
 */
function renderUiComponents(ul) {
    if (!ul)
        return;
    const pageType = (0,_infra_page_detector__WEBPACK_IMPORTED_MODULE_4__.detectCurrentPage)();
    // チェックボックスの描画
    (0,_checkbox_manager__WEBPACK_IMPORTED_MODULE_2__.renderCheckboxes)(ul, () => (0,_order_display__WEBPACK_IMPORTED_MODULE_3__.renderOrderNumbers)(ul, _logic_selection_manager__WEBPACK_IMPORTED_MODULE_0__.selectionManager));
    // 順番表示の描画
    (0,_order_display__WEBPACK_IMPORTED_MODULE_3__.renderOrderNumbers)(ul, _logic_selection_manager__WEBPACK_IMPORTED_MODULE_0__.selectionManager);
    // ページタイプ別のUI初期化
    (0,_bulk_bar__WEBPACK_IMPORTED_MODULE_1__.initializePageUI)(ul);
    // コントロールバー（選択カウンター）の描画
    (0,_bulk_bar__WEBPACK_IMPORTED_MODULE_1__.renderBulkBar)(_logic_selection_manager__WEBPACK_IMPORTED_MODULE_0__.selectionManager.getCount());
}
/**
 * 既存のUI要素を取得または新規作成
 * @param id 要素ID
 * @param tagName 要素のタグ名
 * @returns 取得または作成した要素
 */
function getOrCreateElement(id, tagName) {
    let element = document.getElementById(id);
    if (element && element.tagName === tagName.toUpperCase()) {
        return element;
    }
    element = document.createElement(tagName);
    element.id = id;
    return element;
}
/**
 * DOM要素がすでに存在するか確認
 * @param id 要素ID
 * @returns 存在するかどうか
 */
function elementExists(id) {
    return document.getElementById(id) !== null;
}


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!******************************!*\
  !*** ./src/content/index.ts ***!
  \******************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _logic_observer_manager__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./logic/observer-manager */ "./src/content/logic/observer-manager.ts");
/* harmony import */ var _logic_app_initializer__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./logic/app-initializer */ "./src/content/logic/app-initializer.ts");
/* harmony import */ var _infra_page_detector__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./infra/page-detector */ "./src/content/infra/page-detector.ts");
/* harmony import */ var _infra_constants__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./infra/constants */ "./src/content/infra/constants.ts");
// content scriptのエントリーポイント




// ページタイプに応じた初期化
const pageType = (0,_infra_page_detector__WEBPACK_IMPORTED_MODULE_2__.detectCurrentPage)();
// アプリケーション起動
_logic_app_initializer__WEBPACK_IMPORTED_MODULE_1__.appInitializer.initialize();
// ページタイプに応じた監視開始
if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_3__.PageType.DRAFTS) {
    //
}
else if (pageType === _infra_constants__WEBPACK_IMPORTED_MODULE_3__.PageType.LISTINGS) {
    _logic_observer_manager__WEBPACK_IMPORTED_MODULE_0__.observerManager.startObserving();
}

})();

/******/ })()
;
//# sourceMappingURL=content.js.map
