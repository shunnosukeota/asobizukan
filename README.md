# あそびずかん

休み時間にできる遊びを、時間・場所・人数・道具からさがせるサイト。

## 構成

```
build.mjs        静的サイト生成（依存パッケージなし）
src/games.js     遊びのデータ（ここを編集する）
src/style.css    共通スタイル
img/             図版 16枚（幅800px webp）
fonts/           サブセット済みフォント + ライセンス
dist/            ★ 出力。Cloudflare Pages にはここを置く
```

## ビルド

```bash
node build.mjs
```

`dist/` に 17ページ（トップ + あそび16件）と sitemap.xml / robots.txt が出力されます。

## デプロイ

```bash
npx wrangler pages deploy dist --project-name=asobizukan
```

## 遊びを追加するとき

1. `src/games.js` に追記（漢字は `{漢字|かんじ}` 記法でルビを付ける）
2. `build.mjs` の `SLUGS` にURL用のスラッグを追加
3. `img/` に同じ連番で図版を追加
4. **フォントを再生成する**（新しい漢字はサブセットに入っていないため）
5. `node build.mjs`

## 方針メモ

- 1あそび＝1URL。絞り込みはトップページ内のUIのみでURLは作らない。
  遊びが50件を超えたら絞り込みページの追加を検討する（それ未満だと内容が薄くなる）
- 広告を入れるときは枠に min-height を先に確保する（CLS対策）
