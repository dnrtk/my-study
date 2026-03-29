# 資格学習アプリ

AWS資格試験の学習を支援する個人用Webアプリケーション。問題演習を通じて知識の定着を図る。

## 機能

- **出題モード** — 全問ランダム / カテゴリ別 / 誤答のみ / お気に入りのみ
- **出題数指定** — 10問 / 20問 / 30問 / 全問から選択
- **選択肢シャッフル** — 問題・選択肢の表示順をランダム化
- **解説表示** — 回答後に各選択肢の正解・不正解理由を表示
- **お気に入り** — 復習したい問題をブックマーク
- **学習進捗ダッシュボード** — カテゴリ別正答率・総回答数・未着手数を一覧表示
- **レスポンシブデザイン** — PC・スマートフォン両対応

## 対応資格

| 資格 | 問題数 |
|---|---|
| AWS Certified Data Engineer - Associate (DEA-C01) | 60問（4ドメイン x 15問） |

## 技術スタック

- **フロントエンド** — HTML + JavaScript + CSS（フレームワーク不使用）
- **ホスティング** — GitHub Pages
- **認証・DB** — Supabase（GitHub OAuth + PostgreSQL）
- **外部ライブラリ** — js-yaml（CDN）、supabase-js（CDN）

## ディレクトリ構成

```
.
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js            # ルーティング・初期化
│   ├── auth.js            # Supabase認証
│   ├── data.js            # YAML読み込み・パース
│   ├── quiz.js            # 出題・回答・解説・結果
│   ├── dashboard.js       # ダッシュボード
│   └── utils.js           # シャッフル・DOM生成ヘルパー
├── data/
│   ├── exams.yml          # 資格一覧定義
│   └── questions/
│       └── aws-dae/       # AWS DEA-C01 問題データ
│           ├── ingestion-transformation.yml
│           ├── data-store.yml
│           ├── data-operations.yml
│           └── security-governance.yml
└── doc/
    ├── 01_Requests.md     # 要求一覧
    ├── 02_Specifications.md # 仕様書
    └── 03_Design.md       # 設計書
```

## セットアップ手順

### 1. Supabaseプロジェクトの作成

1. [Supabase](https://supabase.com/) にログインし、新しいプロジェクトを作成する
2. プロジェクトの **Settings > API** から以下の値を控える
   - **Project URL** （例: `https://xxxxx.supabase.co`）
   - **anon public key**

### 2. Supabase認証設定（GitHub OAuth）

1. [GitHub Developer Settings](https://github.com/settings/developers) で新しい OAuth App を作成する
   - **Application name**: 任意（例: 資格学習アプリ）
   - **Homepage URL**: GitHub PagesのURL（例: `https://<username>.github.io/<repo>/`）
   - **Authorization callback URL**: `https://<your-project>.supabase.co/auth/v1/callback`
2. 作成後、Client ID と Client Secret を控える
3. Supabaseの **Authentication > Providers > GitHub** を有効化し、Client ID と Client Secret を入力する

### 3. データベーステーブルの作成

Supabaseの **SQL Editor** で以下のSQLを実行する。

```sql
-- answer_logs
create table answer_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  exam_id text not null,
  question_id text not null,
  selected_choice text not null,
  is_correct boolean not null,
  answered_at timestamptz default now()
);

alter table answer_logs enable row level security;

create policy "Users can insert own logs"
  on answer_logs for insert with check (auth.uid() = user_id);

create policy "Users can read own logs"
  on answer_logs for select using (auth.uid() = user_id);

create index idx_answer_logs_user_exam
  on answer_logs (user_id, exam_id);

create index idx_answer_logs_user_question
  on answer_logs (user_id, question_id);

-- favorites
create table favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  exam_id text not null,
  question_id text not null,
  created_at timestamptz default now(),
  unique (user_id, question_id)
);

alter table favorites enable row level security;

create policy "Users can manage own favorites"
  on favorites for all using (auth.uid() = user_id);

create index idx_favorites_user_exam
  on favorites (user_id, exam_id);
```

### 4. アプリケーションの設定

`js/auth.js` の以下の値を、手順1で控えた実際の値に置き換える。

```javascript
var SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
var SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

### 5. GitHub Pagesへのデプロイ

1. GitHubにリポジトリを作成し、コードをpushする
2. リポジトリの **Settings > Pages** を開く
3. **Source** で `Deploy from a branch` を選択し、`main`ブランチの `/ (root)` を指定する
4. 数分後、`https://<username>.github.io/<repo>/` でアクセス可能になる

### 6. 動作確認

1. デプロイされたURLにアクセスする
2. 「GitHubでログイン」ボタンでログインする
3. 資格を選択し、出題モードを選んで学習を開始する

## 問題の追加・編集

問題データはYAMLファイルで管理している。`data/questions/<exam-id>/` 配下のYAMLを編集してpushすれば反映される。

### 問題のフォーマット

```yaml
questions:
  - id: "一意のID"
    text: "問題文"
    choices:
      - id: "a"
        text: "選択肢A"
        explanation: "正解/不正解の理由"
      - id: "b"
        text: "選択肢B"
        explanation: "正解/不正解の理由"
      - id: "c"
        text: "選択肢C"
        explanation: "正解/不正解の理由"
      - id: "d"
        text: "選択肢D"
        explanation: "正解/不正解の理由"
    answer: "正解の選択肢ID"
```

### 新しい資格の追加

1. `data/exams.yml` に資格エントリを追加する
2. `data/questions/<exam-id>/` ディレクトリを作成し、カテゴリごとのYAMLを配置する
3. pushして反映

## ライセンス

個人利用
