(function () {
  var cache = {};

  /**
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async function fetchYaml(url) {
    if (cache[url]) return cache[url];
    var response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch: ' + url);
    var text = await response.text();
    var data = jsyaml.load(text);
    cache[url] = data;
    return data;
  }

  /**
   * @returns {Promise<Object[]>}
   */
  async function fetchExams() {
    var data = await fetchYaml('data/exams.yml');
    return data.exams;
  }

  /**
   * @param {string} examId
   * @param {string[]} [categoryIds]
   * @returns {Promise<Object[]>}
   */
  async function fetchQuestions(examId, categoryIds) {
    var exams = await fetchExams();
    var exam = exams.find(function (e) { return e.id === examId; });
    if (!exam) throw new Error('Exam not found: ' + examId);

    var categories = exam.categories;
    if (categoryIds && categoryIds.length > 0) {
      categories = categories.filter(function (c) {
        return categoryIds.indexOf(c.id) >= 0;
      });
    }

    var allQuestions = [];
    for (var cat of categories) {
      var url = 'data/questions/' + examId + '/' + cat.file;
      try {
        var data = await fetchYaml(url);
        var questions = (data.questions || []).map(function (q) {
          q.categoryId = cat.id;
          q.categoryName = cat.name;
          return q;
        });
        allQuestions = allQuestions.concat(questions);
      } catch (e) {
        console.error('Failed to load questions from ' + url, e);
      }
    }
    return allQuestions;
  }

  /**
   * @param {string} examId
   * @returns {Promise<Object>}
   */
  async function fetchExam(examId) {
    var exams = await fetchExams();
    return exams.find(function (e) { return e.id === examId; });
  }

  window.App = window.App || {};
  window.App.Data = {
    fetchExams: fetchExams,
    fetchExam: fetchExam,
    fetchQuestions: fetchQuestions,
  };
})();
