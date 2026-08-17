import path from 'path';
import webpack from 'webpack';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * webpackの共通設定を生成する。
 *
 * - content script / popup / options はブラウザ、background は service worker で動くため
 *   target が異なる。そのため設定を配列で分けている。
 */
const createConfig = (isProd, { name, target, entry, plugins = [] }) => ({
  name,
  target,
  plugins,
  mode: isProd ? 'production' : 'development',
  entry,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    // service worker では document を参照できないため publicPath の自動判定を無効化する
    publicPath: '',
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  optimization: {
    minimize: isProd,
  },
  devtool: isProd ? false : 'source-map',
});

export default (env, argv) => {
  const isProd = argv.mode === 'production';
  return [
    createConfig(isProd, {
      name: 'browser',
      target: 'web',
      entry: {
        content: './src/content/index.ts',
        edit: './src/content/edit-entry.ts',
        popup: './src/popup/index.ts',
        options: './src/options/index.ts',
      },
    }),
    createConfig(isProd, {
      name: 'background',
      target: 'webworker',
      entry: {
        background: './src/background/index.ts',
      },
      // service workerは単一ファイルである必要があるため、動的importもまとめて1チャンクにする
      plugins: [new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 })],
    }),
  ];
};
