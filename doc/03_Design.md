# 03. 設計書

## 1. アーキテクチャ設計

### 1.1 全体方針

クライアントサイド完結のSPAアーキテクチャを採用する。サーバーサイドロジックは持たず、Supabaseをデータストア兼認証基盤としてクライアントから直接操作する。

### 1.2 レイヤー構成

```
┌─────────────────────────────────────────────────┐
│  View層（DOM操作・画面描画）                       │
│  index.html + 各 render 関数                     │
├─────────────────────────────────────────────────┤
│  Router層（画面遷移・ハッシュルーティング）          │
│  app.js                                         │
├─────────────────────────────────────────────────┤
│  Logic層（出題・フィルタ・シャッフル・集計）          │
│  quiz.js / dashboard.js                         │
├─────────────────────────────────────────────────┤
│  Data層（外部データの取得・永続化）                  │
│  data.js / auth.js                              │
├─────────────────────────────────────────────────┤
│  External（GitHub Pages / Supabase）             │
└─────────────────────────────────────────────────┘
```

各層は上から下への一方向依存とし、下位層が上位層を参照しない。

## 2. ルーティング設計

### 2.1 方式

GitHub Pagesはサーバーサイドルーティングを持たないため、ハッシュベースルーティング（`location.hash`）を採用する。

### 2.2 ルート定義

| ハッシュ | 画面 | 説明 |
|---|---|---|
| `#/login` | ログイン画面 | 未認証時のデフォルト |
| `#/home` | ホーム画面 | 認証後のデフォルト |
| `#/setup` | 出題設定画面 | モード・カテゴリ・出題数選択 |
| `#/quiz` | 出題画面 | 出題中 |
| `#/explanation` | 解説画面 | 回答後の解説表示 |
| `#/result` | 結果画面 | セッション成績 |
| `#/dashboard` | ダッシュボード画面 | 学習進捗 |

### 2.3 ルーティングフロー

```
hashchange イベント
    │
    ▼
parseHash()  →  route文字列を取得
    │
    ▼
認証チェック
    │
    ├─ 未認証 & route ≠ login  →  #/login にリダイレクト
    │
    └─ 認証済み or login
        │
        ▼
    対応する render 関数を呼び出し
        │
        ▼
    #app コンテナの innerHTML を差し替え
        │
        ▼
    フェードインアニメーション適用
```

### 2.4 ルーターの実装方針

```javascript
// app.js
const routes = {
  '/login':       renderLogin,
  '/home':        renderHome,
  '/setup':       renderSetup,
  '/quiz':        renderQuiz,
  '/explanation': renderExplanation,
  '/result':      renderResult,
  '/dashboard':   renderDashboard,
};

function navigate(path) {
  location.hash = path;
}

function onHashChange() {
  const path = location.hash.slice(1) || '/login';
  const session = supabase.auth.getSession();

  if (!session && path !== '/login') {
    navigate('/login');
    return;
  }
  if (session && path === '/login') {
    navigate('/home');
    return;
  }

  const renderFn = routes[path];
  if (renderFn) {
    const app = document.getElementById('app');
    app.classList.remove('fade-in');
    requestAnimationFrame(() => {
      renderFn(app);
      requestAnimationFrame(() => app.classList.add('fade-in'));
    });
  }
}

window.addEventListener('hashchange', onHashChange);
```

## 3. モジュール設計

### 3.1 モジュール一覧と責務

```
js/
├── app.js           # ルーティング・初期化・画面遷移
├── auth.js          # Supabase認証（ログイン・ログアウト・セッション管理）
├── quiz.js          # 出題セッション管理・回答処理・解説/結果描画
├── dashboard.js     # ダッシュボード描画・集計クエリ
├── data.js          # YAML fetch・パース・キャッシュ
└── utils.js         # シャッフル・DOM生成ヘルパー
```

### 3.2 app.js — エントリポイント・ルーティング

```
責務:
  - DOMContentLoaded でSupabase初期化・セッション復元
  - hashchange リスナーの登録
  - ルートと render 関数のマッピング
  - 認証ガード（未認証時のリダイレクト）
  - 画面遷移アニメーションの制御

公開関数:
  navigate(path: string): void
    ハッシュを変更して画面遷移する

  initApp(): Promise<void>
    Supabase初期化・セッション確認・初期ルーティング実行

依存: auth.js
```

### 3.3 auth.js — 認証

```
責務:
  - Supabaseクライアントの生成・保持
  - GitHub OAuthログイン・ログアウト
  - セッション状態の提供
  - onAuthStateChange コールバックの管理

公開関数:
  initSupabase(): SupabaseClient
    Supabaseクライアントを生成して返す

  getClient(): SupabaseClient
    初期化済みのクライアントを返す

  signIn(): Promise<void>
    GitHub OAuthでログインする

  signOut(): Promise<void>
    ログアウトする

  getUser(): User | null
    現在のログインユーザーを返す

  onAuthChange(callback: (event, session) => void): void
    認証状態の変化を購読する

定数（環境設定）:
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string

依存: supabase-js (CDN)
```

### 3.4 data.js — データ取得

```
責務:
  - exams.yml の取得・パース
  - 問題YAMLの取得・パース
  - 取得済みデータのメモリキャッシュ（同一セッション内で再fetchしない）

公開関数:
  fetchExams(): Promise<Exam[]>
    資格一覧を取得する

  fetchQuestions(examId: string, categoryIds?: string[]): Promise<Question[]>
    指定資格・カテゴリの問題を取得する
    categoryIds省略時は全カテゴリを取得する

型定義（JSDoc）:
  /**
   * @typedef {Object} Exam
   * @property {string} id
   * @property {string} name
   * @property {string} description
   * @property {Category[]} categories
   */

  /**
   * @typedef {Object} Category
   * @property {string} id
   * @property {string} name
   * @property {string} file
   */

  /**
   * @typedef {Object} Question
   * @property {string} id
   * @property {string} text
   * @property {Choice[]} choices
   * @property {string} answer
   * @property {string} categoryId  -- パース時に付与
   */

  /**
   * @typedef {Object} Choice
   * @property {string} id
   * @property {string} text
   * @property {string} explanation
   */

依存: js-yaml (CDN)
```

### 3.5 quiz.js — 出題・回答ロジック

```
責務:
  - 出題セッションの状態管理（現在の問題番号、回答結果リスト）
  - 出題モードに応じたフィルタリング
  - 回答の正誤判定
  - answer_logs への書き込み
  - favorites の読み書き
  - 出題画面・解説画面・結果画面の描画

セッション状態（モジュールスコープ変数）:
  currentSession: {
    examId: string,
    mode: 'random' | 'category' | 'wrong' | 'favorite',
    questions: Question[],    // シャッフル・カット済み
    currentIndex: number,
    answers: Answer[],        // ユーザーの回答記録
  }

  /**
   * @typedef {Object} Answer
   * @property {string} questionId
   * @property {string} selectedChoice
   * @property {boolean} isCorrect
   */

公開関数:
  startSession(config: SessionConfig): Promise<void>
    セッションを初期化し、出題画面を描画する

  renderSetup(container: HTMLElement): Promise<void>
    出題設定画面を描画する

  renderQuiz(container: HTMLElement): void
    現在の問題を描画する

  renderExplanation(container: HTMLElement): void
    解説画面を描画する

  renderResult(container: HTMLElement): void
    結果画面を描画する

内部関数:
  filterByMode(questions, mode, examId): Promise<Question[]>
    モードに応じてSupabase問い合わせ + フィルタ

  submitAnswer(questionId, selectedChoice, isCorrect): Promise<void>
    answer_logs にINSERT

  toggleFavorite(examId, questionId): Promise<boolean>
    お気に入りの登録/解除をトグルし、新しい状態を返す

  isFavorite(examId, questionId): Promise<boolean>
    お気に入り登録済みか判定する

依存: auth.js, data.js, utils.js
```

### 3.6 dashboard.js — ダッシュボード

```
責務:
  - 集計クエリの発行（カテゴリ別正答率、総回答数等）
  - ダッシュボード画面の描画
  - プログレスバー / テーブルの生成

公開関数:
  renderDashboard(container: HTMLElement): Promise<void>
    ダッシュボード画面を描画する

内部関数:
  fetchStats(examId): Promise<Stats>
    answer_logs を集計する

  /**
   * @typedef {Object} Stats
   * @property {number} totalAnswers        -- 延べ回答数
   * @property {number} totalQuestions       -- 全問題数
   * @property {number} unattemptedCount     -- 未着手問題数
   * @property {number} favoriteCount        -- お気に入り登録数
   * @property {CategoryStat[]} categories   -- カテゴリ別統計
   */

  /**
   * @typedef {Object} CategoryStat
   * @property {string} categoryId
   * @property {string} categoryName
   * @property {number} correctCount
   * @property {number} totalCount
   * @property {number} accuracy   -- 正答率 (0-100)
   */

依存: auth.js, data.js
```

### 3.7 utils.js — ユーティリティ

```
責務:
  - Fisher-Yatesシャッフル
  - DOM要素生成ヘルパー

公開関数:
  shuffle(array: any[]): any[]
    配列を破壊的にシャッフルして返す（Fisher-Yates）

  createElement(tag: string, attrs?: Object, children?: (string|Node)[]): HTMLElement
    DOM要素を生成する

依存: なし
```

## 4. 状態管理設計

### 4.1 方針

フレームワーク不使用のため、状態管理はモジュールスコープ変数で行う。グローバル状態は最小限に留め、各モジュールが自身の責務に関する状態のみを保持する。

### 4.2 状態の所在

| 状態 | 保持場所 | ライフサイクル |
|---|---|---|
| 認証セッション | Supabase SDK内部 | ブラウザセッション（リロードで復元） |
| 資格・問題データキャッシュ | data.js モジュールスコープ | ページライフサイクル（リロードで破棄） |
| 出題セッション | quiz.js モジュールスコープ | 出題開始〜結果表示 |
| 選択中の資格ID | app.js モジュールスコープ | ページライフサイクル |
| 回答履歴・お気に入り | Supabase DB | 永続 |

## 5. Supabaseアクセス設計

### 5.1 クエリ一覧

#### answer_logs

| 操作 | 用途 | クエリ |
|---|---|---|
| INSERT | 回答記録 | `supabase.from('answer_logs').insert({ user_id, exam_id, question_id, selected_choice, is_correct })` |
| SELECT (誤答) | 誤答フィルタ | `supabase.from('answer_logs').select('question_id').eq('exam_id', examId).eq('is_correct', false)` |
| SELECT (集計) | ダッシュボード | `supabase.from('answer_logs').select('question_id, is_correct').eq('exam_id', examId)` |

#### favorites

| 操作 | 用途 | クエリ |
|---|---|---|
| SELECT | お気に入り一覧 | `supabase.from('favorites').select('question_id').eq('exam_id', examId)` |
| SELECT (単一) | 登録判定 | `supabase.from('favorites').select('id').eq('question_id', questionId).maybeSingle()` |
| INSERT | 登録 | `supabase.from('favorites').insert({ user_id, exam_id, question_id })` |
| DELETE | 解除 | `supabase.from('favorites').delete().eq('question_id', questionId)` |

### 5.2 RLSとuser_id

RLSが有効なため、クエリにuser_idのWHERE句は不要（Supabaseが自動でフィルタする）。ただしINSERT時にはuser_idカラムの値としてauth.uid()相当を渡す必要がある。

```javascript
const { data: { user } } = await supabase.auth.getUser();
await supabase.from('answer_logs').insert({
  user_id: user.id,
  exam_id: examId,
  question_id: questionId,
  selected_choice: choiceId,
  is_correct: isCorrect,
});
```

## 6. 画面描画設計

### 6.1 描画方針

単一の`index.html`に`<div id="app"></div>`コンテナを設け、各画面のrender関数がinnerHTMLで内容を差し替える。イベントリスナーはrender関数内でDOM生成後に登録する。

### 6.2 index.html 構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>資格学習アプリ</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <header id="header">
    <!-- ログイン後: ユーザー名・ログアウトボタン -->
  </header>
  <main id="app">
    <!-- 各画面のコンテンツがここに描画される -->
  </main>

  <!-- 外部ライブラリ -->
  <script src="https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

  <!-- アプリケーション -->
  <script src="js/utils.js"></script>
  <script src="js/auth.js"></script>
  <script src="js/data.js"></script>
  <script src="js/quiz.js"></script>
  <script src="js/dashboard.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

### 6.3 スクリプト読み込み順序

依存関係に基づき、以下の順序で読み込む。各スクリプトは即時実行関数またはモジュールスコープで名前空間を分離する。

```
1. utils.js       ← 依存なし
2. auth.js        ← supabase-js
3. data.js        ← js-yaml
4. quiz.js        ← auth.js, data.js, utils.js
5. dashboard.js   ← auth.js, data.js
6. app.js         ← 全モジュール（エントリポイント）
```

### 6.4 名前空間

グローバル汚染を防ぐため、各モジュールはIIFE（即時実行関数式）で囲み、`window.App`オブジェクトに公開関数を登録する。

```javascript
// 例: utils.js
(function() {
  function shuffle(array) { /* ... */ }
  function createElement(tag, attrs, children) { /* ... */ }

  window.App = window.App || {};
  window.App.Utils = { shuffle, createElement };
})();

// 例: quiz.js
(function() {
  const { shuffle } = App.Utils;
  const { getClient, getUser } = App.Auth;
  // ...

  window.App.Quiz = { startSession, renderSetup, renderQuiz, renderExplanation, renderResult };
})();
```

## 7. CSS設計

### 7.1 設計方針

単一の`style.css`で管理する。BEM風の命名規則でクラス名の衝突を防ぐ。

### 7.2 CSSカスタムプロパティ

```css
:root {
  /* カラー */
  --color-primary: #1976d2;
  --color-primary-hover: #1565c0;
  --color-correct: #4caf50;
  --color-correct-bg: #e8f5e9;
  --color-wrong: #f44336;
  --color-wrong-bg: #ffebee;
  --color-favorite: #ff9800;
  --color-bg: #f5f5f5;
  --color-surface: #ffffff;
  --color-text: #212121;
  --color-text-secondary: #757575;
  --color-border: #e0e0e0;

  /* レイアウト */
  --content-max-width: 720px;
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* アニメーション */
  --transition-fast: 100ms ease;
  --transition-normal: 150ms ease;
  --transition-feedback: 200ms ease;

  /* タッチターゲット */
  --touch-min-size: 44px;
}
```

### 7.3 アニメーション定義

```css
/* 画面遷移フェードイン */
.fade-in {
  animation: fadeIn var(--transition-normal) forwards;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* 回答フィードバック */
.choice--correct {
  background-color: var(--color-correct-bg);
  border-color: var(--color-correct);
  transition: background-color var(--transition-feedback),
              border-color var(--transition-feedback);
}

.choice--wrong {
  background-color: var(--color-wrong-bg);
  border-color: var(--color-wrong);
  transition: background-color var(--transition-feedback),
              border-color var(--transition-feedback);
}

/* お気に入りトグル */
.favorite-btn--active {
  animation: bounce var(--transition-feedback) ease;
}

@keyframes bounce {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.3); }
  100% { transform: scale(1); }
}

/* ボタン押下 */
.btn:active {
  transform: scale(0.96);
  transition: transform var(--transition-fast);
}

/* 選択肢ホバー */
.choice:hover {
  background-color: var(--color-bg);
  transition: background-color var(--transition-fast);
}
```

### 7.4 レスポンシブ

```css
/* ベース: モバイルファースト */
.container {
  width: 100%;
  max-width: var(--content-max-width);
  margin: 0 auto;
  padding: var(--spacing-md);
}

/* デスクトップ */
@media (min-width: 768px) {
  .container {
    padding: var(--spacing-xl);
  }

  .dashboard__categories {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--spacing-md);
  }
}
```

## 8. エラーハンドリング設計

### 8.1 方針

| エラー種別 | 対応 |
|---|---|
| YAML fetch失敗 | 画面にエラーメッセージを表示し、リトライ導線を提供 |
| YAMLパースエラー | コンソールにエラー出力、画面にメッセージ表示 |
| Supabase認証エラー | ログイン画面にリダイレクトし、メッセージ表示 |
| Supabase DBエラー | 画面にトーストでエラー通知（回答自体は継続可能とする） |
| 対象問題0件 | 開始ボタンを無効化し、メッセージ表示 |

### 8.2 トースト通知

DB書き込み失敗などの非致命的エラーは、画面上部にトーストメッセージで3秒間表示し、自動で消える。

```javascript
function showToast(message, type = 'error') {
  const toast = createElement('div', { class: `toast toast--${type}` }, [message]);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}
```

## 9. セキュリティ設計

### 9.1 方針

| 対策 | 内容 |
|---|---|
| XSS防止 | ユーザー入力はないが、YAMLから読み込んだ文字列をDOMに挿入する際は`textContent`を使用し、`innerHTML`への生文字列挿入を避ける |
| RLS | Supabase RLSにより、認証ユーザー自身のデータのみアクセス可能 |
| APIキー | Supabase Anon Keyはpublicキーであり、RLSと併用する前提で公開可能。ソースコードに直接記述する |
| HTTPS | GitHub Pages・SupabaseともにデフォルトでHTTPS |

## 10. 仕様トレーサビリティ

| 仕様箇所 | 設計箇所 |
|---|---|
| 2.1 画面一覧 | 2.2 ルート定義 |
| 2.2-2.8 画面仕様 | 6. 画面描画設計 |
| 3.1 問題データ | 3.4 data.js |
| 3.2-3.3 Supabase | 5. Supabaseアクセス設計 |
| 4. 出題ロジック | 3.5 quiz.js |
| 5. 認証フロー | 3.3 auth.js |
| 6.1 アニメーション | 7.3 アニメーション定義 |
| 6.2 レスポンシブ | 7.4 レスポンシブ |
| 6.3 配色 | 7.2 CSSカスタムプロパティ |
| 7. ファイル構成 | 3.1 モジュール一覧, 6.2 index.html |
