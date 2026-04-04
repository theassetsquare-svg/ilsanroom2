// Read count — daily increment
(function () {
  var countEl = document.getElementById('readCount');
  if (!countEl) return;

  var base = 12847;
  var today = new Date();
  var dayOffset = today.getFullYear() * 365 + today.getMonth() * 30 + today.getDate();
  var total = base + (dayOffset % 300);
  countEl.textContent = total.toLocaleString('ko-KR');
})();

// Secret section reveal at 80% scroll
(function () {
  var secretContent = document.getElementById('secretContent');
  if (!secretContent) return;

  var revealed = false;

  function checkScroll() {
    if (revealed) return;

    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var scrollPercent = (scrollTop / docHeight) * 100;

    if (scrollPercent >= 75) {
      secretContent.classList.add('revealed');
      revealed = true;
      window.removeEventListener('scroll', checkScroll);
    }
  }

  window.addEventListener('scroll', checkScroll, { passive: true });
})();
