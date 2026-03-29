(function () {
  var shuffle = App.Utils.shuffle;
  var createElement = App.Utils.createElement;
  var showToast = App.Utils.showToast;

  var currentSession = null;

  /**
   * @param {Object} config
   * @param {string} config.examId
   * @param {'random'|'category'|'wrong'|'favorite'} config.mode
   * @param {string[]} [config.categoryIds]
   * @param {number} [config.limit]
   */
  async function startSession(config) {
    var questions = await App.Data.fetchQuestions(config.examId, config.categoryIds);

    if (config.mode === 'wrong') {
      var wrongIds = await getWrongQuestionIds(config.examId);
      questions = questions.filter(function (q) { return wrongIds.indexOf(q.id) >= 0; });
    } else if (config.mode === 'favorite') {
      var favIds = await getFavoriteQuestionIds(config.examId);
      questions = questions.filter(function (q) { return favIds.indexOf(q.id) >= 0; });
    }

    shuffle(questions);

    if (config.limit && config.limit > 0 && config.limit < questions.length) {
      questions = questions.slice(0, config.limit);
    }

    // Shuffle choices for each question
    questions.forEach(function (q) {
      q.choices = shuffle(q.choices.slice());
    });

    currentSession = {
      examId: config.examId,
      mode: config.mode,
      questions: questions,
      currentIndex: 0,
      answers: [],
    };
  }

  function getSession() {
    return currentSession;
  }

  // --- Supabase helpers ---

  async function getWrongQuestionIds(examId) {
    var client = App.Auth.getClient();
    var { data, error } = await client
      .from('answer_logs')
      .select('question_id')
      .eq('exam_id', examId)
      .eq('is_correct', false);
    if (error) { console.error(error); return []; }
    return [...new Set(data.map(function (r) { return r.question_id; }))];
  }

  async function getFavoriteQuestionIds(examId) {
    var client = App.Auth.getClient();
    var { data, error } = await client
      .from('favorites')
      .select('question_id')
      .eq('exam_id', examId);
    if (error) { console.error(error); return []; }
    return data.map(function (r) { return r.question_id; });
  }

  async function submitAnswer(examId, questionId, selectedChoice, isCorrect) {
    var client = App.Auth.getClient();
    var user = await App.Auth.getUser();
    if (!user) return;
    var { error } = await client.from('answer_logs').insert({
      user_id: user.id,
      exam_id: examId,
      question_id: questionId,
      selected_choice: selectedChoice,
      is_correct: isCorrect,
    });
    if (error) {
      showToast('Failed to save answer: ' + error.message);
    }
  }

  async function toggleFavorite(examId, questionId) {
    var client = App.Auth.getClient();
    var user = await App.Auth.getUser();
    if (!user) return false;

    var { data } = await client
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();

    if (data) {
      await client.from('favorites').delete().eq('id', data.id);
      return false;
    } else {
      var { error } = await client.from('favorites').insert({
        user_id: user.id,
        exam_id: examId,
        question_id: questionId,
      });
      if (error) showToast('Failed to save favorite: ' + error.message);
      return true;
    }
  }

  async function isFavorite(questionId) {
    var client = App.Auth.getClient();
    var user = await App.Auth.getUser();
    if (!user) return false;
    var { data } = await client
      .from('favorites')
      .select('id')
      .eq('user_id', user.id)
      .eq('question_id', questionId)
      .maybeSingle();
    return !!data;
  }

  // --- Render functions ---

  async function renderSetup(container, examId) {
    var exam = await App.Data.fetchExam(examId);
    if (!exam) {
      container.innerHTML = '<div class="container"><p>Exam not found.</p></div>';
      return;
    }

    var html = '<div class="container fade-in">';
    html += '<h2 class="page-title">' + escapeHtml(exam.name) + '</h2>';
    html += '<h3 class="section-title">出題モード</h3>';
    html += '<div class="mode-select">';
    html += '<label class="radio-card"><input type="radio" name="mode" value="random" checked><span>全問ランダム</span></label>';
    html += '<label class="radio-card"><input type="radio" name="mode" value="category"><span>カテゴリ別</span></label>';
    html += '<label class="radio-card"><input type="radio" name="mode" value="wrong"><span>誤答のみ</span></label>';
    html += '<label class="radio-card"><input type="radio" name="mode" value="favorite"><span>お気に入りのみ</span></label>';
    html += '</div>';

    html += '<div id="category-select" class="category-select" style="display:none;">';
    html += '<h3 class="section-title">カテゴリ選択</h3>';
    for (var cat of exam.categories) {
      html += '<label class="checkbox-card"><input type="checkbox" name="category" value="' + cat.id + '" checked><span>' + escapeHtml(cat.name) + '</span></label>';
    }
    html += '</div>';

    html += '<h3 class="section-title">出題数</h3>';
    html += '<div class="limit-select">';
    html += '<label class="radio-card"><input type="radio" name="limit" value="10" checked><span>10問</span></label>';
    html += '<label class="radio-card"><input type="radio" name="limit" value="20"><span>20問</span></label>';
    html += '<label class="radio-card"><input type="radio" name="limit" value="30"><span>30問</span></label>';
    html += '<label class="radio-card"><input type="radio" name="limit" value="0"><span>全問</span></label>';
    html += '</div>';

    html += '<button id="start-btn" class="btn btn--primary btn--lg">開始</button>';
    html += '<p id="setup-message" class="message" style="display:none;"></p>';
    html += '</div>';
    container.innerHTML = html;

    // Show/hide category select
    container.querySelectorAll('input[name="mode"]').forEach(function (radio) {
      radio.addEventListener('change', function () {
        var catDiv = document.getElementById('category-select');
        catDiv.style.display = this.value === 'category' ? 'block' : 'none';
      });
    });

    // Start button
    document.getElementById('start-btn').addEventListener('click', async function () {
      var mode = container.querySelector('input[name="mode"]:checked').value;
      var limitVal = parseInt(container.querySelector('input[name="limit"]:checked').value, 10);

      var categoryIds = null;
      if (mode === 'category') {
        categoryIds = [];
        container.querySelectorAll('input[name="category"]:checked').forEach(function (cb) {
          categoryIds.push(cb.value);
        });
        if (categoryIds.length === 0) {
          document.getElementById('setup-message').textContent = 'カテゴリを1つ以上選択してください。';
          document.getElementById('setup-message').style.display = 'block';
          return;
        }
      }

      await startSession({
        examId: examId,
        mode: mode,
        categoryIds: categoryIds,
        limit: limitVal,
      });

      if (currentSession.questions.length === 0) {
        document.getElementById('setup-message').textContent = '対象の問題がありません。';
        document.getElementById('setup-message').style.display = 'block';
        return;
      }

      App.navigate('/quiz');
    });
  }

  function renderQuiz(container) {
    if (!currentSession || currentSession.currentIndex >= currentSession.questions.length) {
      App.navigate('/home');
      return;
    }

    var q = currentSession.questions[currentSession.currentIndex];
    var total = currentSession.questions.length;
    var num = currentSession.currentIndex + 1;

    var html = '<div class="container fade-in">';
    html += '<div class="quiz-header">';
    html += '<span class="quiz-progress">' + num + ' / ' + total + '</span>';
    html += '<button id="fav-btn" class="btn btn--icon fav-btn" title="お気に入り">&#9734;</button>';
    html += '</div>';
    html += '<div class="progress-bar"><div class="progress-bar__fill" style="width:' + (num / total * 100) + '%"></div></div>';
    html += '<div class="question-text">' + escapeHtml(q.text) + '</div>';
    html += '<div class="choices">';
    for (var choice of q.choices) {
      html += '<button class="choice" data-id="' + choice.id + '">' + escapeHtml(choice.text) + '</button>';
    }
    html += '</div>';
    html += '<button id="answer-btn" class="btn btn--primary" disabled>回答する</button>';
    html += '</div>';
    container.innerHTML = html;

    var selectedChoiceId = null;

    // Favorite button
    (async function () {
      var fav = await isFavorite(q.id);
      var favBtn = document.getElementById('fav-btn');
      if (fav) {
        favBtn.innerHTML = '&#9733;';
        favBtn.classList.add('fav-btn--active');
      }
    })();

    document.getElementById('fav-btn').addEventListener('click', async function () {
      var newState = await toggleFavorite(currentSession.examId, q.id);
      this.innerHTML = newState ? '&#9733;' : '&#9734;';
      this.classList.toggle('fav-btn--active', newState);
      if (newState) this.classList.add('favorite-btn--active');
    });

    // Choice selection
    container.querySelectorAll('.choice').forEach(function (btn) {
      btn.addEventListener('click', function () {
        container.querySelectorAll('.choice').forEach(function (b) { b.classList.remove('choice--selected'); });
        this.classList.add('choice--selected');
        selectedChoiceId = this.getAttribute('data-id');
        document.getElementById('answer-btn').disabled = false;
      });
    });

    // Answer button
    document.getElementById('answer-btn').addEventListener('click', async function () {
      if (!selectedChoiceId) return;
      var isCorrect = selectedChoiceId === q.answer;

      currentSession.answers.push({
        questionId: q.id,
        selectedChoice: selectedChoiceId,
        isCorrect: isCorrect,
      });

      await submitAnswer(currentSession.examId, q.id, selectedChoiceId, isCorrect);
      App.navigate('/explanation');
    });
  }

  function renderExplanation(container) {
    if (!currentSession) { App.navigate('/home'); return; }

    var idx = currentSession.currentIndex;
    var q = currentSession.questions[idx];
    var ans = currentSession.answers[idx];

    var html = '<div class="container fade-in">';
    html += '<div class="result-badge result-badge--' + (ans.isCorrect ? 'correct' : 'wrong') + '">';
    html += ans.isCorrect ? '正解！' : '不正解';
    html += '</div>';
    html += '<div class="question-text">' + escapeHtml(q.text) + '</div>';
    html += '<div class="choices">';
    for (var choice of q.choices) {
      var cls = 'choice choice--disabled';
      if (choice.id === q.answer) cls += ' choice--correct';
      if (choice.id === ans.selectedChoice && !ans.isCorrect) cls += ' choice--wrong';
      if (choice.id === ans.selectedChoice) cls += ' choice--selected';

      html += '<div class="' + cls + '">';
      html += '<div class="choice__text">' + escapeHtml(choice.text) + '</div>';
      html += '<div class="choice__explanation">' + escapeHtml(choice.explanation) + '</div>';
      html += '</div>';
    }
    html += '</div>';

    var isLast = idx >= currentSession.questions.length - 1;
    if (isLast) {
      html += '<button id="next-btn" class="btn btn--primary btn--lg">結果を見る</button>';
    } else {
      html += '<button id="next-btn" class="btn btn--primary btn--lg">次の問題へ</button>';
    }
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('next-btn').addEventListener('click', function () {
      if (isLast) {
        App.navigate('/result');
      } else {
        currentSession.currentIndex++;
        App.navigate('/quiz');
      }
    });
  }

  function renderResult(container) {
    if (!currentSession) { App.navigate('/home'); return; }

    var total = currentSession.answers.length;
    var correct = currentSession.answers.filter(function (a) { return a.isCorrect; }).length;
    var pct = total > 0 ? Math.round(correct / total * 100) : 0;

    var html = '<div class="container fade-in">';
    html += '<h2 class="page-title">結果</h2>';
    html += '<div class="result-summary">';
    html += '<div class="result-score">' + correct + ' / ' + total + '</div>';
    html += '<div class="result-pct">' + pct + '%</div>';
    html += '</div>';

    html += '<div class="result-list">';
    for (var i = 0; i < currentSession.questions.length; i++) {
      var q = currentSession.questions[i];
      var a = currentSession.answers[i];
      var icon = a.isCorrect ? '<span class="icon-correct">&#10003;</span>' : '<span class="icon-wrong">&#10007;</span>';
      html += '<div class="result-item">';
      html += icon + ' <span class="result-item__text">' + escapeHtml(q.text.substring(0, 60)) + (q.text.length > 60 ? '...' : '') + '</span>';
      html += '</div>';
    }
    html += '</div>';

    html += '<button id="home-btn" class="btn btn--primary btn--lg">ホームに戻る</button>';
    html += '</div>';
    container.innerHTML = html;

    document.getElementById('home-btn').addEventListener('click', function () {
      currentSession = null;
      App.navigate('/home');
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  window.App = window.App || {};
  window.App.Quiz = {
    startSession: startSession,
    getSession: getSession,
    renderSetup: renderSetup,
    renderQuiz: renderQuiz,
    renderExplanation: renderExplanation,
    renderResult: renderResult,
  };
})();
