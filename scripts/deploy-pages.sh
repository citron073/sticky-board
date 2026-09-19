#!/usr/bin/env bash
set -euo pipefail

# mainのソースをGitHubへpushした後に実行する。
# distだけを一時Gitリポジトリとしてgh-pagesブランチへ反映する。
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
remote_url="$(git -C "$project_dir" remote get-url origin)"
temp_dir="$(mktemp -d /private/tmp/sticky-board-pages.XXXXXX)"
trap 'rm -rf "$temp_dir"' EXIT

cd "$project_dir"
npm run build
cp -R dist/. "$temp_dir/"

git -C "$temp_dir" init -b gh-pages
git -C "$temp_dir" config user.name "$(git -C "$project_dir" config user.name)"
git -C "$temp_dir" config user.email "$(git -C "$project_dir" config user.email)"
git -C "$temp_dir" add .
git -C "$temp_dir" commit -m "Deploy GitHub Pages"
git -C "$temp_dir" remote add origin "$remote_url"
git -C "$temp_dir" push --force origin gh-pages
