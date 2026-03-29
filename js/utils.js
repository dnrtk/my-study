(function () {
  /**
   * Fisher-Yates shuffle (in-place)
   * @param {any[]} array
   * @returns {any[]}
   */
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * @param {string} tag
   * @param {Object} [attrs]
   * @param {(string|Node)[]} [children]
   * @returns {HTMLElement}
   */
  function createElement(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'class') {
          el.className = value;
        } else if (key.startsWith('on')) {
          el.addEventListener(key.slice(2).toLowerCase(), value);
        } else {
          el.setAttribute(key, value);
        }
      }
    }
    if (children) {
      for (const child of children) {
        if (typeof child === 'string') {
          el.appendChild(document.createTextNode(child));
        } else if (child) {
          el.appendChild(child);
        }
      }
    }
    return el;
  }

  /**
   * @param {string} message
   * @param {'error'|'success'|'info'} [type='error']
   */
  function showToast(message, type) {
    type = type || 'error';
    const container = document.getElementById('toast-container');
    const toast = createElement('div', { class: 'toast toast--' + type }, [message]);
    container.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('toast--visible');
    });
    setTimeout(function () {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', function () {
        toast.remove();
      });
    }, 3000);
  }

  window.App = window.App || {};
  window.App.Utils = { shuffle: shuffle, createElement: createElement, showToast: showToast };
})();
