(function setupToast() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }

  /**
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} [type='info']
   * @param {number} [duration=3000]
   */
  window.showToast = function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3000;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    toast.style.animationDuration = '0.3s, 0.3s';
    toast.style.animationDelay = '0s, ' + (duration - 300) + 'ms';
    container.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, duration);
  };
})();
