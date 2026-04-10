/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/*!****************************!*\
  !*** ./src/popup/index.ts ***!
  \****************************/

/**
 * popup.htmlの「開始」ボタンにクリックイベントを登録し、
 * 拡張機能の動作確認用アラートを表示する。
 */
document.getElementById('start')?.addEventListener('click', () => {
    alert('拡張機能が動作しました！');
});

/******/ })()
;
//# sourceMappingURL=popup.js.map