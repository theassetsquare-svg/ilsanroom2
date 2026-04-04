// Monthly read count
(function () {
  var countEl = document.getElementById('readCount');
  if (!countEl) return;
  var base = 12847;
  var today = new Date();
  var dayOfMonth = today.getDate();
  var total = base + (dayOfMonth * 43);
  countEl.textContent = total.toLocaleString('ko-KR');
})();

// Countdown seats — random 2-5 based on day
(function () {
  var seatsEl = document.getElementById('seatsLeft');
  if (!seatsEl) return;
  var today = new Date();
  var dayOfWeek = today.getDay();
  var seats = (dayOfWeek === 5 || dayOfWeek === 6) ? 2 : 3 + (today.getDate() % 3);
  seatsEl.textContent = seats;
})();

// Gallery swipe with dot navigation
(function () {
  var track = document.getElementById('galleryTrack');
  var dotsContainer = document.getElementById('galleryDots');
  if (!track || !dotsContainer) return;

  var dots = dotsContainer.querySelectorAll('.dot');
  var currentIndex = 0;

  function updateDots(index) {
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === index);
    }
  }

  // Scroll-based dot update
  track.addEventListener('scroll', function () {
    var slideWidth = track.offsetWidth;
    var newIndex = Math.round(track.scrollLeft / slideWidth);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < dots.length) {
      currentIndex = newIndex;
      updateDots(currentIndex);
    }
  }, { passive: true });

  // Dot click navigation
  for (var i = 0; i < dots.length; i++) {
    (function (idx) {
      dots[idx].addEventListener('click', function () {
        track.scrollTo({ left: track.offsetWidth * idx, behavior: 'smooth' });
      });
    })(i);
  }
})();

// Mini Quiz
(function () {
  var container = document.getElementById('quizContainer');
  var resultEl = document.getElementById('quizResult');
  if (!container || !resultEl) return;

  var steps = container.querySelectorAll('.quiz-step');
  var answers = [];
  var currentStep = 0;

  var results = {
    a: {
      title: '라페스타 권역이 딱입니다!',
      desc: '활기찬 분위기와 다양한 선택지를 좋아하는 당신에게 라페스타가 최적입니다. 마두역에서 도보 5분, 선택의 폭이 넓어서 절대 후회 없습니다.'
    },
    b: {
      title: '웨스턴돔 권역을 추천합니다',
      desc: '조용한 대화와 안정적인 서비스를 원하는 당신에게 웨스턴돔이 맞습니다. 검증된 곳에서 편안하게 즐기세요.'
    },
    c: {
      title: '정발산역 인근이 맞습니다!',
      desc: '트렌디하고 깔끔한 신규 매장을 원하는 당신에게 정발산역 쪽이 제격입니다. 새로운 경험을 원한다면 여기가 답입니다.'
    }
  };

  container.addEventListener('click', function (e) {
    var btn = e.target.closest('.quiz-option');
    if (!btn) return;

    // Highlight selected
    var siblings = steps[currentStep].querySelectorAll('.quiz-option');
    for (var i = 0; i < siblings.length; i++) {
      siblings[i].classList.remove('selected');
    }
    btn.classList.add('selected');

    answers.push(btn.getAttribute('data-value'));

    setTimeout(function () {
      steps[currentStep].classList.remove('active');
      currentStep++;

      if (currentStep < steps.length) {
        steps[currentStep].classList.add('active');
      } else {
        showResult();
      }
    }, 300);
  });

  function showResult() {
    // Count most frequent answer
    var count = { a: 0, b: 0, c: 0 };
    for (var i = 0; i < answers.length; i++) {
      count[answers[i]]++;
    }
    var winner = 'a';
    if (count.b > count[winner]) winner = 'b';
    if (count.c > count[winner]) winner = 'c';

    var r = results[winner];
    resultEl.innerHTML =
      '<p class="quiz-result-title">' + r.title + '</p>' +
      '<p class="quiz-result-desc">' + r.desc + '</p>' +
      '<a href="https://ilsanroom.pages.dev/" class="cta-button" target="_blank" rel="noopener">놀쿨에서 자세히 보기 →</a>';
    resultEl.classList.add('show');
  }
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

// Exit Intent — scroll up detection (mobile-friendly)
(function () {
  var popup = document.getElementById('exitPopup');
  var closeBtn = document.getElementById('exitClose');
  if (!popup || !closeBtn) return;

  var shown = false;
  var lastScrollY = 0;
  var scrollUpDistance = 0;
  var threshold = 300;

  function onScroll() {
    if (shown) return;

    var currentY = window.pageYOffset || document.documentElement.scrollTop;

    // Only trigger after user has scrolled past 40% of page
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var scrollPercent = (currentY / docHeight) * 100;
    if (scrollPercent < 40) {
      lastScrollY = currentY;
      return;
    }

    if (currentY < lastScrollY) {
      scrollUpDistance += (lastScrollY - currentY);
    } else {
      scrollUpDistance = 0;
    }

    lastScrollY = currentY;

    if (scrollUpDistance > threshold) {
      popup.classList.add('show');
      shown = true;
      window.removeEventListener('scroll', onScroll);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  closeBtn.addEventListener('click', function () {
    popup.classList.remove('show');
  });

  popup.addEventListener('click', function (e) {
    if (e.target === popup) {
      popup.classList.remove('show');
    }
  });
})();
