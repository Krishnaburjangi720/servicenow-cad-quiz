/* ======================================================
   ServiceNow CAD Quiz – Application Logic
   ====================================================== */

// ── State ──
let quizMode = 'practice';       // practice | exam
let activeQuestions = [];
let currentIndex = 0;
let userAnswers = [];             // array of arrays (selected option indices)
let answered = [];                // bool per question
let score = 0;
let timerInterval = null;
let timeLeft = 90 * 60;           // 90 min in seconds
let startTime = 0;
let selectedCategory = null;

// ── DOM refs ──
const $ = id => document.getElementById(id);
const screens = document.querySelectorAll('.screen');

function showScreen(id) {
    screens.forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    window.scrollTo(0, 0);
}

// ── Particles ──
(function initParticles() {
    const canvas = $('particleCanvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    window.addEventListener('resize', resize);
    resize();

    for (let i = 0; i < 60; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: Math.random() * 2 + 0.5,
            dx: (Math.random() - 0.5) * 0.4,
            dy: (Math.random() - 0.5) * 0.4,
            o: Math.random() * 0.3 + 0.05
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            p.x += p.dx; p.y += p.dy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(99,102,241,${p.o})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }
    draw();
})();

// ── Shuffle ──
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ── Shuffle Options within a question ──
function shuffleOptions(question) {
    const q = { ...question };
    // Build index mapping: create array of indices [0,1,2,...] and shuffle
    const indices = q.options.map((_, i) => i);
    const shuffled = shuffle(indices);
    // Reorder options
    q.options = shuffled.map(i => question.options[i]);
    // Remap correct answer indices
    q.correct = question.correct.map(ci => shuffled.indexOf(ci));
    return q;
}

// ── Landing ──
function goToLanding() {
    stopTimer();
    showScreen('landing-screen');
}

// ── Category Picker ──
function showCategoryPicker() {
    const grid = $('category-grid');
    grid.innerHTML = '';
    CATEGORIES.forEach(cat => {
        const count = QUESTIONS.filter(q => q.category === cat).length;
        const icon = CATEGORY_ICONS[cat] || '📋';
        const card = document.createElement('div');
        card.className = 'category-card';
        card.innerHTML = `<div class="cat-icon">${icon}</div><div class="cat-name">${cat}</div><div class="cat-count">${count} questions</div>`;
        card.onclick = () => startQuiz('practice', cat);
        grid.appendChild(card);
    });
    showScreen('category-screen');
}

// ── Start Quiz ──
function startQuiz(mode, category) {
    quizMode = mode;
    selectedCategory = category || null;
    currentIndex = 0;
    score = 0;
    startTime = Date.now();

    if (category) {
        activeQuestions = shuffle(QUESTIONS.filter(q => q.category === category)).map(shuffleOptions);
    } else {
        activeQuestions = shuffle(QUESTIONS).map(shuffleOptions);
    }

    userAnswers = activeQuestions.map(() => []);
    answered = activeQuestions.map(() => false);

    // UI setup
    $('quiz-mode-badge').textContent = mode === 'exam' ? 'EXAM' : 'PRACTICE';
    $('quiz-category-badge').textContent = category || 'All Topics';
    $('quiz-category-badge').classList.toggle('hidden', !category);
    $('score-display').classList.toggle('hidden', mode === 'exam');

    // Timer
    if (mode === 'exam') {
        timeLeft = 90 * 60;
        $('timer-display').classList.remove('hidden');
        startTimer();
    } else {
        $('timer-display').classList.add('hidden');
        stopTimer();
    }

    buildDots();
    renderQuestion();
    showScreen('quiz-screen');
}

// ── Timer ──
function startTimer() {
    stopTimer();
    updateTimerDisplay();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) { stopTimer(); finishQuiz(); }
    }, 1000);
}

function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    $('timer-text').textContent = `${m}:${s.toString().padStart(2, '0')}`;
    const td = $('timer-display');
    td.classList.remove('warning', 'danger');
    if (timeLeft <= 300) td.classList.add('danger');
    else if (timeLeft <= 600) td.classList.add('warning');
}

// ── Dots ──
function buildDots() {
    const container = $('question-dots');
    container.innerHTML = '';
    const maxDots = Math.min(activeQuestions.length, 40);
    for (let i = 0; i < maxDots; i++) {
        const dot = document.createElement('div');
        dot.className = 'q-dot';
        dot.title = `Question ${i + 1}`;
        dot.onclick = () => goToQuestion(i);
        container.appendChild(dot);
    }
    updateDots();
}

function updateDots() {
    const dots = $('question-dots').children;
    for (let i = 0; i < dots.length; i++) {
        dots[i].className = 'q-dot';
        if (i === currentIndex) dots[i].classList.add('current');
        else if (answered[i]) {
            if (quizMode === 'practice') {
                const q = activeQuestions[i];
                const isCorrect = arraysEqual(userAnswers[i].sort(), q.correct.sort());
                dots[i].classList.add(isCorrect ? 'correct-dot' : 'incorrect-dot');
            } else {
                dots[i].classList.add('answered');
            }
        }
    }
}

function goToQuestion(idx) {
    if (idx < 0 || idx >= activeQuestions.length) return;
    currentIndex = idx;
    renderQuestion();
}

// ── Render Question ──
function renderQuestion() {
    const q = activeQuestions[currentIndex];
    const total = activeQuestions.length;

    $('current-q-num').textContent = currentIndex + 1;
    $('total-q-num').textContent = total;
    $('q-number').textContent = `Q${currentIndex + 1}`;
    $('q-type').textContent = q.multi ? `Choose ${q.correct.length} options` : 'Choose 1 option';
    $('question-text').textContent = q.question;
    $('progress-fill').style.width = `${((currentIndex + 1) / total) * 100}%`;
    $('score-display').textContent = `Score: ${score}`;

    // Options
    const list = $('options-list');
    list.innerHTML = '';
    const letters = 'ABCDEFGH';
    q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        // Restore selection
        if (userAnswers[currentIndex].includes(i)) btn.classList.add('selected');
        // If already answered in practice mode, show correct/incorrect
        if (answered[currentIndex] && quizMode === 'practice') {
            btn.classList.add('disabled');
            if (q.correct.includes(i)) btn.classList.add('correct');
            if (userAnswers[currentIndex].includes(i) && !q.correct.includes(i)) btn.classList.add('incorrect');
        }

        const letterText = letters[i];
        const optText = opt.replace(/^[A-H]\.\s*/, '');

        btn.innerHTML = `<span class="option-letter">${letterText}</span><span>${optText}</span>`;
        btn.onclick = () => selectOption(i);
        list.appendChild(btn);
    });

    // Explanation
    const expBox = $('explanation-box');
    if (answered[currentIndex] && quizMode === 'practice') {
        expBox.classList.remove('hidden');
        const correctTexts = q.correct.map(ci => q.options[ci]).join(', ');
        $('explanation-text').textContent = correctTexts;
    } else {
        expBox.classList.add('hidden');
    }

    // Nav buttons
    $('prev-btn').disabled = currentIndex === 0;
    $('next-btn').textContent = currentIndex === total - 1 ? 'Finish' : 'Next';
    $('next-btn').innerHTML = currentIndex === total - 1
        ? 'Finish <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>'
        : 'Next <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>';

    updateDots();

    // Animate card
    const card = $('question-card');
    card.style.animation = 'none';
    card.offsetHeight;
    card.style.animation = 'slideUp 0.35s ease';
}

// ── Select Option ──
function selectOption(idx) {
    if (answered[currentIndex] && quizMode === 'practice') return;
    const q = activeQuestions[currentIndex];

    if (q.multi) {
        const pos = userAnswers[currentIndex].indexOf(idx);
        if (pos > -1) userAnswers[currentIndex].splice(pos, 1);
        else userAnswers[currentIndex].push(idx);
    } else {
        userAnswers[currentIndex] = [idx];
    }

    // In practice mode, auto-submit single-choice or when enough selected
    if (quizMode === 'practice') {
        if (!q.multi || userAnswers[currentIndex].length === q.correct.length) {
            submitAnswer();
            return;
        }
    }

    renderQuestion();
}

function submitAnswer() {
    const q = activeQuestions[currentIndex];
    answered[currentIndex] = true;
    const isCorrect = arraysEqual(userAnswers[currentIndex].sort(), [...q.correct].sort());
    if (isCorrect) score++;
    renderQuestion();
}

// ── Navigation ──
function nextQuestion() {
    // In exam mode, mark as answered if selections exist
    if (quizMode === 'exam' && userAnswers[currentIndex].length > 0) {
        answered[currentIndex] = true;
    }

    if (currentIndex < activeQuestions.length - 1) {
        currentIndex++;
        renderQuestion();
    } else {
        finishQuiz();
    }
}

function prevQuestion() {
    if (currentIndex > 0) {
        currentIndex--;
        renderQuestion();
    }
}

// ── Finish ──
function finishQuiz() {
    stopTimer();
    const elapsed = Math.floor((Date.now() - startTime) / 1000);

    // Calculate score for exam mode
    if (quizMode === 'exam') {
        score = 0;
        activeQuestions.forEach((q, i) => {
            if (answered[i] && arraysEqual(userAnswers[i].sort(), [...q.correct].sort())) score++;
        });
    }

    const total = activeQuestions.length;
    const pct = Math.round((score / total) * 100);
    const incorrect = answered.filter((a, i) => a && !arraysEqual(userAnswers[i].sort(), [...activeQuestions[i].correct].sort())).length;
    const skipped = answered.filter(a => !a).length;

    // Results UI
    $('score-percent').textContent = `${pct}%`;
    $('score-fraction').textContent = `${score}/${total}`;
    $('stat-correct').textContent = score;
    $('stat-incorrect').textContent = incorrect;
    $('stat-skipped').textContent = skipped;
    const em = Math.floor(elapsed / 60);
    const es = elapsed % 60;
    $('stat-time').textContent = `${em}:${es.toString().padStart(2, '0')}`;

    // Icon & message
    if (pct >= 80) {
        $('results-icon').textContent = '🏆';
        $('results-title').textContent = 'Excellent Work!';
        $('results-subtitle').textContent = 'You\'re well prepared for the CAD exam!';
    } else if (pct >= 60) {
        $('results-icon').textContent = '👍';
        $('results-title').textContent = 'Good Effort!';
        $('results-subtitle').textContent = 'Review the missed questions to improve.';
    } else {
        $('results-icon').textContent = '📚';
        $('results-title').textContent = 'Keep Studying!';
        $('results-subtitle').textContent = 'Focus on weak areas and try again.';
    }

    // Animate score circle
    setTimeout(() => {
        const progress = $('score-progress');
        const offset = 534 - (534 * pct / 100);
        progress.style.strokeDashoffset = offset;
    }, 100);

    $('review-section').classList.add('hidden');
    showScreen('results-screen');
}

// ── Review ──
function reviewAnswers() {
    const section = $('review-section');
    const list = $('review-list');
    section.classList.remove('hidden');
    list.innerHTML = '';

    activeQuestions.forEach((q, i) => {
        const isAnswered = answered[i];
        const isCorrect = isAnswered && arraysEqual(userAnswers[i].sort(), [...q.correct].sort());
        let statusClass, statusText;
        if (!isAnswered) { statusClass = 'st-skipped'; statusText = 'Skipped'; }
        else if (isCorrect) { statusClass = 'st-correct'; statusText = 'Correct'; }
        else { statusClass = 'st-incorrect'; statusText = 'Incorrect'; }

        const correctTexts = q.correct.map(ci => q.options[ci]).join(', ');
        const yourTexts = userAnswers[i].map(ci => q.options[ci]).join(', ') || 'No answer';

        const item = document.createElement('div');
        item.className = `review-item review-${isAnswered ? (isCorrect ? 'correct' : 'incorrect') : 'skipped'}`;
        item.innerHTML = `
            <div class="review-q-header">
                <span class="review-q-num">Question ${i + 1}</span>
                <span class="review-status ${statusClass}">${statusText}</span>
            </div>
            <div class="review-q-text">${q.question}</div>
            <div class="review-answer">
                <div><strong>Your Answer:</strong> <span class="${isCorrect ? 'correct-ans' : 'your-ans'}">${yourTexts}</span></div>
                <div><strong>Correct Answer:</strong> <span class="correct-ans">${correctTexts}</span></div>
            </div>`;
        list.appendChild(item);
    });

    section.scrollIntoView({ behavior: 'smooth' });
}

function retryQuiz() {
    startQuiz(quizMode, selectedCategory);
}

// ── Modal ──
function confirmQuit() {
    $('confirm-modal').classList.remove('hidden');
}
function closeModal() {
    $('confirm-modal').classList.add('hidden');
}
function quitQuiz() {
    closeModal();
    stopTimer();
    goToLanding();
}

// ── Utility ──
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
}

// ── Add SVG gradient for score circle ──
(function addScoreGradient() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.innerHTML = `<defs><linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#a855f7"/>
    </linearGradient></defs>`;
    document.body.appendChild(svg);
})();
