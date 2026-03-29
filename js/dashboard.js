(function () {
  var createElement = App.Utils.createElement;
  var escapeHtml = function (str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  };

  async function fetchStats(examId) {
    var client = App.Auth.getClient();
    var user = await App.Auth.getUser();
    if (!user) return null;

    var allQuestions = await App.Data.fetchQuestions(examId);

    // Fetch answer logs
    var { data: logs, error } = await client
      .from('answer_logs')
      .select('question_id, is_correct')
      .eq('exam_id', examId);
    if (error) { console.error(error); logs = []; }

    // Fetch favorites count
    var { data: favs, error: favErr } = await client
      .from('favorites')
      .select('question_id')
      .eq('exam_id', examId);
    if (favErr) { console.error(favErr); favs = []; }

    var answeredIds = new Set(logs.map(function (l) { return l.question_id; }));
    var totalQuestions = allQuestions.length;
    var unattemptedCount = allQuestions.filter(function (q) { return !answeredIds.has(q.id); }).length;

    // Category stats
    var catMap = {};
    allQuestions.forEach(function (q) {
      if (!catMap[q.categoryId]) {
        catMap[q.categoryId] = { categoryId: q.categoryId, categoryName: q.categoryName, correctCount: 0, totalCount: 0 };
      }
    });

    logs.forEach(function (log) {
      var q = allQuestions.find(function (q) { return q.id === log.question_id; });
      if (q && catMap[q.categoryId]) {
        catMap[q.categoryId].totalCount++;
        if (log.is_correct) catMap[q.categoryId].correctCount++;
      }
    });

    var categories = Object.values(catMap).map(function (c) {
      c.accuracy = c.totalCount > 0 ? Math.round(c.correctCount / c.totalCount * 100) : 0;
      return c;
    });

    return {
      totalAnswers: logs.length,
      totalQuestions: totalQuestions,
      unattemptedCount: unattemptedCount,
      favoriteCount: favs.length,
      categories: categories,
    };
  }

  async function renderDashboard(container, examId) {
    container.innerHTML = '<div class="container fade-in"><p class="loading">Loading...</p></div>';

    var exam = await App.Data.fetchExam(examId);
    var stats = await fetchStats(examId);

    if (!stats) {
      container.innerHTML = '<div class="container"><p>Failed to load dashboard.</p></div>';
      return;
    }

    var html = '<div class="container fade-in">';
    html += '<h2 class="page-title">' + escapeHtml(exam.name) + '</h2>';
    html += '<h3 class="section-title">学習進捗</h3>';

    // Summary cards
    html += '<div class="dashboard-cards">';
    html += '<div class="card"><div class="card__value">' + stats.totalAnswers + '</div><div class="card__label">総回答数</div></div>';
    html += '<div class="card"><div class="card__value">' + stats.totalQuestions + '</div><div class="card__label">全問題数</div></div>';
    html += '<div class="card"><div class="card__value">' + stats.unattemptedCount + '</div><div class="card__label">未着手</div></div>';
    html += '<div class="card"><div class="card__value">' + stats.favoriteCount + '</div><div class="card__label">お気に入り</div></div>';
    html += '</div>';

    // Category accuracy
    html += '<h3 class="section-title">カテゴリ別正答率</h3>';
    html += '<div class="category-stats">';
    for (var cat of stats.categories) {
      var barColor = cat.accuracy >= 80 ? 'var(--color-correct)' : cat.accuracy >= 50 ? 'var(--color-favorite)' : 'var(--color-wrong)';
      html += '<div class="category-stat">';
      html += '<div class="category-stat__name">' + escapeHtml(cat.categoryName) + '</div>';
      html += '<div class="category-stat__bar">';
      html += '<div class="category-stat__fill" style="width:' + cat.accuracy + '%;background-color:' + barColor + '"></div>';
      html += '</div>';
      html += '<div class="category-stat__pct">' + cat.accuracy + '% (' + cat.correctCount + '/' + cat.totalCount + ')</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '<button id="back-btn" class="btn btn--secondary btn--lg">ホームに戻る</button>';
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('back-btn').addEventListener('click', function () {
      App.navigate('/home');
    });
  }

  window.App = window.App || {};
  window.App.Dashboard = { renderDashboard: renderDashboard };
})();
