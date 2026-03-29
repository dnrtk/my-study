# 02. 仕様書

## 1. システム概要

AWS資格試験の学習を支援する個人用SPA（Single Page Application）。GitHub Pagesで静的サイトとして配信し、バックエンドにSupabase（認証・DB）を利用する。

### 1.1 システム構成図

```
┌─────────────┐     fetch      ┌──────────────────┐
│  ブラウザ     │ ──────────── │  GitHub Pages     │
│  (SPA)       │ ◄──────────── │  - HTML/JS/CSS    │
│              │               │  - 問題YAML       │
└──────┬───────┘               └──────────────────┘
       │
       │  supabase-js
       ▼
┌──────────────────┐
│  Supabase         │
│  - Auth (GitHub)  │
│  - PostgreSQL     │
│    - answer_logs  │
│    - favorites    │
└──────────────────┘
```

## 2. 画面仕様

### 2.1 画面一覧

| 画面 | 説明 | 対応REQ |
|---|---|---|
| ログイン画面 | GitHub OAuthでログイン | REQ-012 |
| ホーム画面 | 資格選択・出題モード選択 | REQ-002, REQ-008 |
| 出題設定画面 | モード・カテゴリ・出題数を選択 | REQ-002, REQ-006 |
| 出題画面 | 問題表示・回答入力 | REQ-001, REQ-005 |
| 解説画面 | 正誤判定・各選択肢の解説表示 | REQ-003 |
| 結果画面 | セッション内の成績サマリ | REQ-001 |
| ダッシュボード画面 | 学習進捗の一覧表示 | REQ-007 |

### 2.2 ログイン画面

- 「GitHubでログイン」ボタンを表示する
- Supabase Authの`signInWithOAuth({ provider: 'github' })`を呼び出す
- 認証済みの場合はホーム画面にリダイレクトする

### 2.3 ホーム画面

- ログインユーザー名を表示する
- 資格一覧を表示し、学習する資格を選択する（初期はDAEのみ）
- 資格選択後、出題モードを選択する
  - 全問ランダム
  - カテゴリ別
  - 誤答のみ
  - お気に入りのみ
- ダッシュボードへの導線を設ける

### 2.4 出題設定画面

- 選択したモードに応じた設定項目を表示する
  - カテゴリ別の場合: カテゴリ選択（複数選択可）
  - 共通: 出題数の指定（10問 / 20問 / 30問 / 全問）
- 「開始」ボタンで出題画面に遷移する
- 対象問題が0件の場合は開始不可とし、メッセージを表示する

### 2.5 出題画面

- 画面上部にプログレス表示（例: 3 / 20）
- 問題文を表示する
- 選択肢をシャッフルした順序で表示する
- 選択肢を1つ選択して「回答する」ボタンで確定する
- お気に入りの登録・解除トグルボタンを設ける（星アイコン等）
- 回答確定後、解説画面に遷移する

### 2.6 解説画面

- 正誤判定の結果を表示する（正解 / 不正解）
- ユーザーが選択した選択肢をハイライトする
- 正解の選択肢を明示する
- 各選択肢について、正解理由または不正解理由を表示する
- 「次の問題へ」ボタンで次の問題に進む
- 最終問題の場合は「結果を見る」ボタンで結果画面に遷移する

### 2.7 結果画面

- セッション内の成績を表示する
  - 正答数 / 出題数
  - 正答率（%）
- 問題ごとの正誤一覧を表示する
- 「ホームに戻る」ボタンを設ける

### 2.8 ダッシュボード画面

- 選択中の資格における以下の情報を表示する
  - カテゴリ別の正答率（棒グラフまたはテーブル）
  - 総回答数（延べ回答数）
  - 未着手問題数（一度も回答していない問題の数）
  - お気に入り登録数

## 3. データ仕様

### 3.1 問題データ（YAML）

#### ディレクトリ構成

```
data/
├── exams.yml          # 資格一覧の定義
└── questions/
    ├── aws-dae/
    │   ├── analytics.yml
    │   ├── ingestion.yml
    │   └── ...
    └── {exam-id}/
        └── {category}.yml
```

#### 資格一覧定義（exams.yml）

```yaml
exams:
  - id: aws-dae
    name: "AWS Certified Data Analytics Engineer"
    description: "AWS データ分析エンジニア"
    categories:
      - id: analytics
        name: "データ分析"
        file: "analytics.yml"
      - id: ingestion
        name: "データ収集"
        file: "ingestion.yml"
```

資格を追加する際は、このファイルにエントリを追加し、対応するディレクトリに問題YAMLを配置する。

#### 問題データ定義（各カテゴリYAML）

```yaml
questions:
  - id: "aws-dae-001"
    text: "Amazon Kinesisの特徴として正しいものはどれか。"
    choices:
      - id: "a"
        text: "バッチ処理専用のサービスである"
        explanation: "Kinesisはリアルタイムストリーミング処理のサービスであり、バッチ処理専用ではない。"
      - id: "b"
        text: "リアルタイムでデータをストリーミング処理できる"
        explanation: "正しい。Kinesisはリアルタイムストリーミングデータの収集・処理・分析を行うサービスである。"
      - id: "c"
        text: "最大保持期間は1時間である"
        explanation: "デフォルトは24時間、最大365日まで延長可能である。"
      - id: "d"
        text: "1シャードあたりの書き込み上限は10MB/秒である"
        explanation: "1シャードあたりの書き込み上限は1MB/秒である。"
    answer: "b"
```

- `id`: 問題の一意識別子。資格IDをプレフィックスとして付与する
- `text`: 問題文
- `choices`: 選択肢の配列。各選択肢にID・本文・解説を持つ
- `choices[].explanation`: その選択肢が正解である理由、または不正解である理由
- `answer`: 正解の選択肢ID

### 3.2 Supabaseテーブル定義

#### answer_logs（回答履歴）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | 主キー（自動生成） |
| user_id | uuid | Supabase AuthのUID（外部キー） |
| exam_id | text | 資格ID（例: aws-dae） |
| question_id | text | 問題ID（例: aws-dae-001） |
| selected_choice | text | ユーザーが選択した選択肢ID |
| is_correct | boolean | 正誤 |
| answered_at | timestamptz | 回答日時（デフォルト: now()） |

#### favorites（お気に入り）

| カラム | 型 | 説明 |
|---|---|---|
| id | uuid | 主キー（自動生成） |
| user_id | uuid | Supabase AuthのUID（外部キー） |
| exam_id | text | 資格ID |
| question_id | text | 問題ID |
| created_at | timestamptz | 登録日時（デフォルト: now()） |

#### RLS（Row Level Security）

各テーブルにRLSを有効化し、`user_id = auth.uid()`の条件でユーザー自身のデータのみアクセス可能とする。

### 3.3 Supabase DDL

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

## 4. 出題ロジック

### 4.1 問題取得フロー

1. `exams.yml`をfetchし、選択された資格の定義を取得する
2. 対象カテゴリの問題YAMLをfetchし、パースする
3. 出題モードに応じてフィルタリングする

### 4.2 フィルタリング

| モード | フィルタ条件 |
|---|---|
| 全問ランダム | フィルタなし（全問対象） |
| カテゴリ別 | 選択されたカテゴリに属する問題のみ |
| 誤答のみ | `answer_logs`に`is_correct = false`の記録がある問題のみ |
| お気に入りのみ | `favorites`に登録されている問題のみ |

### 4.3 シャッフル

- フィルタ後の問題リストをFisher-Yatesアルゴリズムでシャッフルする
- 出題数が指定されている場合、シャッフル後に先頭から指定数を切り出す
- 各問題の選択肢もFisher-Yatesでシャッフルする

## 5. 認証フロー

1. ユーザーが「GitHubでログイン」ボタンをクリック
2. Supabaseの`signInWithOAuth`でGitHubのOAuth画面にリダイレクト
3. GitHub側で認可後、コールバックURLにリダイレクト
4. Supabaseがセッションを生成し、クライアント側でセッション情報を保持
5. 以降のSupabaseリクエストはセッショントークンを自動付与

ログアウト時は`supabase.auth.signOut()`を呼び出す。

## 6. UI/UX仕様

### 6.1 アニメーション

すべてのアニメーションはCSS transitionまたはCSS animationで実装する。JavaScriptによるアニメーションは使用しない。

| 対象 | 演出 | 所要時間 |
|---|---|---|
| 画面遷移 | フェードイン | 150ms |
| 選択肢ホバー | 背景色変化 | 100ms |
| 回答確定 | 正解: 緑にフラッシュ / 不正解: 赤にフラッシュ | 200ms |
| お気に入りトグル | スケールバウンス | 200ms |
| ボタン押下 | スケールダウン | 100ms |

### 6.2 レスポンシブ対応

- ブレークポイント: 768px（以下をモバイル、以上をデスクトップとする）
- モバイル時: シングルカラム、タッチ操作に適したボタンサイズ（最小44x44px）
- デスクトップ時: 中央寄せのコンテンツ領域（最大幅720px）

### 6.3 配色・スタイル

- CSSカスタムプロパティで色を管理し、将来的なテーマ切り替えに備える
- 正解: 緑系（`#4caf50`）、不正解: 赤系（`#f44336`）
- フォント: システムフォントスタック

## 7. ファイル構成

```
/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js            # エントリポイント・ルーティング
│   ├── auth.js            # Supabase認証
│   ├── quiz.js            # 出題・回答ロジック
│   ├── dashboard.js       # ダッシュボード
│   ├── data.js            # YAML読み込み・パース
│   └── utils.js           # シャッフル等のユーティリティ
├── data/
│   ├── exams.yml
│   └── questions/
│       └── aws-dae/
│           └── *.yml
└── doc/
    ├── 01_Requests.md
    └── 02_Specifications.md
```

## 8. 外部依存

| ライブラリ | 用途 | 読み込み方法 |
|---|---|---|
| js-yaml | YAMLパース | CDN (jsdelivr等) |
| supabase-js | Supabase認証・DB操作 | CDN (jsdelivr等) |

## 9. 要求トレーサビリティ

| REQ | 仕様箇所 |
|---|---|
| REQ-001 | 2.5 出題画面 |
| REQ-002 | 2.3 ホーム画面, 2.4 出題設定画面, 4.2 フィルタリング |
| REQ-003 | 2.6 解説画面 |
| REQ-004 | 2.5 出題画面, 3.2 favorites |
| REQ-005 | 4.3 シャッフル |
| REQ-006 | 2.4 出題設定画面, 4.3 シャッフル |
| REQ-007 | 2.8 ダッシュボード画面 |
| REQ-008 | 3.1 ディレクトリ構成, exams.yml |
| REQ-009 | 3.1 問題データ定義 |
| REQ-010 | 3.2 answer_logs |
| REQ-011 | 1.1 システム構成図 |
| REQ-012 | 2.2 ログイン画面, 5. 認証フロー |
| REQ-013 | 7. ファイル構成, 8. 外部依存 |
| REQ-014 | 6.1 アニメーション |
| REQ-015 | 6.2 レスポンシブ対応 |
