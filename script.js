// Read count animation
(function () {
  var countEl = document.getElementById('readCount');
  if (!countEl) return;

  var base = 12847;
  var today = new Date();
  var dayOffset = today.getFullYear() * 365 + today.getMonth() * 30 + today.getDate();
  var total = base + (dayOffset % 300);
  countEl.textContent = total.toLocaleString('ko-KR');
})();
