# あそびずかん

休み時間にできる遊びを、時間・場所・人数・道具からさがせるサイト。

## 構成

```
build.mjs               静的サイト生成（依存パッケージなし）
scripts/build-fonts.mjs フォントのサブセット生成
src/games.js            遊びのデータ（ここを編集する）
src/style.css           共通スタイル
img/                    図版 16枚（幅800px webp）
fonts/                  サブセット済みフォント + ライセンス
wrangler.jsonc          Cloudflare の配信設定
dist/                   ★ 出力（gitignore 済み）
```

## ビルド

```bash
node build.mjs
```

`dist/` に 17ページ（トップ + あそび16件）と sitemap.xml / robots.txt が出力されます。

## デプロイ

`main` に push すると Cloudflare が自動でビルド・デプロイします。
Cloudflare 側の deploy command は次の設定です。

```
node build.mjs && npx wrangler deploy
```

## 表記のルール

- 本文に出る「あそび」は**ひらがな**で統一する（サイト名が あそびずかん のため）
- `<title>` と `description` は「遊び」と**漢字**にする（検索語が漢字のため）

## 遊びを追加するとき

1. `src/games.js` に追記（漢字は `{漢字|かんじ}` 記法でルビを付ける）
2. `build.mjs` の `SLUGS` にURL用のスラッグを追加
3. `img/` に同じ連番で図版を追加
4. **フォントを再生成する** — `npm run fonts`
   新しい漢字はサブセットに入っていないため、これを忘れるとその字だけ
   システムフォントで表示されて書体が変わります
5. `node build.mjs`

## 方針メモ

- 1あそび＝1URL。絞り込みはトップページ内のUIのみでURLは作らない。
  遊びが50件を超えたら絞り込みページの追加を検討する（それ未満だと内容が薄くなる）
- 広告を入れるときは枠に min-height を先に確保する（CLS対策）
