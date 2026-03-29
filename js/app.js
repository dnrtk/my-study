(function () {
  var selectedExamId = null;

  function navigate(path) {
    location.hash = path;
  }

  function renderHeader(user) {
    var header = document.getElementById('header');
    if (user) {
      var name = user.user_metadata && user.user_metadata.user_name
        ? user.user_metadata.user_name
        : user.email || 'User';
      header.innerHTML =
        '<div class="header-inner">' +
        '<a href="#/home" class="header-logo">資格学習</a>' +
        '<div class="header-user">' +
        '<span class="header-username">' + name + '</span>' +
        '<button id="logout-btn" class="btn btn--sm btn--secondary">ログアウト</button>' +
        '</div></div>';
      document.getElementById('logout-btn').addEventListener('click', async function () {
        await App.Auth.signOut();
        navigate('/login');
      });
    } else {
      header.innerHTML = '<div class="header-inner"><span class="header-logo">資格学習</span></div>';
    }
  }

  function renderLogin(container) {
    container.innerHTML =
      '<div class="container fade-in login-page">' +
      '<h1 class="login-title">資格学習アプリ</h1>' +
      '<p class="login-subtitle">AWS資格試験の学習を支援するアプリケーション</p>' +
      '<button id="login-btn" class="btn btn--primary btn--lg btn--github">GitHubでログイン</button>' +
      '</div>';

    document.getElementById('login-btn').addEventListener('click', function () {
      App.Auth.signIn();
    });
  }

  async function renderHome(container) {
    var exams = await App.Data.fetchExams();

    var html = '<div class="container fade-in">';
    html += '<h2 class="page-title">資格を選択</h2>';
    html += '<div class="exam-list">';
    for (var exam of exams) {
      html += '<button class="exam-card" data-exam-id="' + exam.id + '">';
      html += '<div class="exam-card__name">' + exam.name + '</div>';
      html += '<div class="exam-card__desc">' + exam.description + '</div>';
      html += '</button>';
    }
    html += '</div>';

    html += '<div class="home-actions">';
    html += '<button id="dashboard-btn" class="btn btn--secondary btn--lg" style="margin-top:var(--spacing-md)">ダッシュボード</button>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.exam-card').forEach(function (card) {
      card.addEventListener('click', function () {
        selectedExamId = this.getAttribute('data-exam-id');
        navigate('/setup');
      });
    });

    document.getElementById('dashboard-btn').addEventListener('click', function () {
      if (selectedExamId) {
        navigate('/dashboard');
      } else {
        var exCards = container.querySelectorAll('.exam-card');
        if (exCards.length === 1) {
          selectedExamId = exCards[0].getAttribute('data-exam-id');
          navigate('/dashboard');
        } else {
          App.Utils.showToast('先に資格を選択してください', 'info');
        }
      }
    });
  }

  async function onHashChange() {
    var path = location.hash.slice(1) || '/login';
    var appEl = document.getElementById('app');
    var session = await App.Auth.getSession();
    var user = session ? (await App.Auth.getUser()) : null;

    renderHeader(user);

    if (!session && path !== '/login') {
      navigate('/login');
      return;
    }
    if (session && path === '/login') {
      navigate('/home');
      return;
    }

    appEl.classList.remove('fade-in');

    switch (path) {
      case '/login':
        renderLogin(appEl);
        break;
      case '/home':
        await renderHome(appEl);
        break;
      case '/setup':
        if (!selectedExamId) { navigate('/home'); return; }
        await App.Quiz.renderSetup(appEl, selectedExamId);
        break;
      case '/quiz':
        App.Quiz.renderQuiz(appEl);
        break;
      case '/explanation':
        App.Quiz.renderExplanation(appEl);
        break;
      case '/result':
        App.Quiz.renderResult(appEl);
        break;
      case '/dashboard':
        if (!selectedExamId) { navigate('/home'); return; }
        await App.Dashboard.renderDashboard(appEl, selectedExamId);
        break;
      default:
        navigate(session ? '/home' : '/login');
        break;
    }
  }

  async function initApp() {
    App.Auth.initSupabase();

    App.Auth.onAuthChange(function (event, session) {
      if (event === 'SIGNED_IN') {
        navigate('/home');
      } else if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
    });

    window.addEventListener('hashchange', onHashChange);
    await onHashChange();
  }

  window.App = window.App || {};
  window.App.navigate = navigate;

  document.addEventListener('DOMContentLoaded', initApp);
})();
