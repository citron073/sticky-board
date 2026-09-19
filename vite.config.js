import { defineConfig } from 'vite';

// GitHub Pagesのリポジトリ配下でも、生成したassetを相対パスで読み込む。
export default defineConfig({
  base: './',
});
