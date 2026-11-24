(() => {
  "use strict";

  const POS_LABEL = {
    n: "noun", v: "verb", adj: "adjective", adv: "adverb", prep: "preposition",
    conj: "conjunction", pron: "pronoun", det: "determiner", num: "number", int: "interjection",
  };
  const FUNCTION_POS = new Set(["prep", "conj", "pron", "det", "adv", "int", "num"]);

  // Each entry: { id (rank, 1-based), es, pos, en, keys (normalised meanings) }
  const words = WORDS.map(([es, pos, en], i) => ({ id: i + 1, es, pos, en, keys: meaningKeys(en) }));

  // Turn "to have (auxiliary); there is" into ["have", "there is"] for overlap checks,
  // so two options that both mean "to begin" never appear together.
  function meaningKeys(en) {
    return en.replace(/\([^)]*\)/g, "")
      .split(/[,;\/]/)
      .map(s => s.trim().toLowerCase().replace(/^(to|a|an|the)\s+/, "").trim())
      .filter(Boolean);
  }
  const overlaps = (a, b) => a.keys.some(k => b.keys.includes(k)) || a.es === b.es;

  // ---------- storage (best effort) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } },
  };
  let settings = Object.assign({ range: "1-100", from: 1, to: 1000, dir: "es-en", count: 20 }, store.get("es1000.settings", {}));
  let missed = store.get("es1000.missed", {});   // id -> times missed (removed when answered right)
  let history = store.get("es1000.history", { quizzes: 0, answered: 0, correct: 0, best: 0 });

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const esc = s => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function currentRange() {
    let a, b;
    if (settings.range === "custom") { a = +settings.from || 1; b = +settings.to || 1000; }
    else[a, b] = settings.range.split("-").map(Number);
    a = Math.max(1, Math.min(1000, a)); b = Math.max(1, Math.min(1000, b));
    if (a > b) [a, b] = [b, a];
    if (b - a < 9) b = Math.min(1000, a + 9);
    return [a, b];
  }

  // Distractors: same part of speech, close in frequency, never a synonym of the answer.
  function pickDistractors(target, pool) {
    const ok = w => w.id !== target.id && !overlaps(w, target);
    const near = (list) => list.filter(ok).sort((x, y) => Math.abs(x.id - target.id) - Math.abs(y.id - target.id));
    let candidates = near(pool.filter(w => w.pos === target.pos));
    if (candidates.length < 12) candidates = candidates.concat(near(words.filter(w => w.pos === target.pos && !candidates.includes(w))));
    if (candidates.length < 6 && FUNCTION_POS.has(target.pos))
      candidates = candidates.concat(near(words.filter(w => FUNCTION_POS.has(w.pos) && w.pos !== target.pos)));
    if (candidates.length < 3) candidates = candidates.concat(near(words));
    const window = shuffle(candidates.slice(0, 40));
    const chosen = [];
    for (const w of window) {
      if (chosen.every(c => !overlaps(c, w))) chosen.push(w);
      if (chosen.length === 3) break;
    }
    return chosen;
  }

  function buildQuiz(targets, pool) {
    return targets.map(t => {
      const dir = settings.dir === "mix" ? (Math.random() < .5 ? "es-en" : "en-es") : settings.dir;
      return { target: t, dir, options: shuffle([t, ...pickDistractors(t, pool)]), answer: null };
    });
  }

  // ---------- views ----------
  function show(id) {
    ["setup", "quiz", "results", "browse"].forEach(s => $(s).classList.toggle("hidden", s !== id));
    $("navBrowse").classList.toggle("hidden", id === "browse" || id === "quiz");
    $("navHome").classList.toggle("hidden", id !== "browse");
    window.scrollTo(0, 0);
  }

  function renderSetup() {
    document.querySelectorAll("#rangeSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.r === settings.range));
    document.querySelectorAll("#dirSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === settings.dir));
    document.querySelectorAll("#countSeg button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.c === settings.count));
    $("customRow").classList.toggle("hidden", settings.range !== "custom");
    $("rFrom").value = settings.from; $("rTo").value = settings.to;
    const nMissed = Object.keys(missed).length;
    const reviewBtn = $("reviewBtn");
    reviewBtn.textContent = nMissed ? `Practise my missed words (${nMissed})` : "Practise my missed words";
    reviewBtn.disabled = nMissed === 0; reviewBtn.style.opacity = nMissed ? 1 : .45;
    const acc = history.answered ? Math.round(100 * history.correct / history.answered) : 0;
    $("stats").innerHTML = `<span><b>${history.quizzes}</b> quizzes</span><span><b>${acc}%</b> accuracy</span><span><b>${history.best}%</b> best</span><span><b>${nMissed}</b> to review</span>`;
    store.set("es1000.settings", settings);
  }

  // ---------- quiz flow ----------
  let quiz = [], qi = 0, score = 0, lastStart = null;

  function startQuiz(mode) {
    const [a, b] = currentRange();
    const pool = words.filter(w => w.id >= a && w.id <= b);
    let targets;
    if (mode === "missed") {
      const ids = Object.keys(missed).map(Number);
      targets = shuffle(words.filter(w => ids.includes(w.id))).slice(0, settings.count);
    } else if (Array.isArray(mode)) {
      targets = shuffle(mode.slice());
    } else {
      targets = shuffle(pool.slice()).slice(0, settings.count);
    }
    if (!targets.length) return;
    lastStart = mode;
    quiz = buildQuiz(targets, pool.length >= 20 ? pool : words);
    qi = 0; score = 0;
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const q = quiz[qi], t = q.target;
    $("qNum").textContent = `Question ${qi + 1} of ${quiz.length}`;
    $("qScore").textContent = `${score} correct`;
    $("qBar").style.width = `${(qi / quiz.length) * 100}%`;
    const prompt = $("qPrompt");
    prompt.textContent = q.dir === "es-en" ? t.es : t.en;
    prompt.classList.toggle("en", q.dir === "en-es");
    $("qHint").textContent = `${POS_LABEL[t.pos]} · #${t.id} · ${q.dir === "es-en" ? "choose the English meaning" : "choose the Spanish word"}`;
    $("qFeedback").textContent = ""; $("qFeedback").className = "feedback";
    $("nextBtn").classList.add("hidden");
    const opts = $("qOpts"); opts.innerHTML = "";
    q.options.forEach((o, i) => {
      const btn = document.createElement("button");
      btn.className = "opt";
      btn.innerHTML = `<kbd>${i + 1}</kbd><span>${esc(q.dir === "es-en" ? o.en : o.es)}</span>`;
      btn.onclick = () => answer(i);
      opts.appendChild(btn);
    });
  }

  function answer(i) {
    const q = quiz[qi];
    if (q.answer !== null || !q.options[i]) return;
    q.answer = q.options[i];
    const right = q.answer.id === q.target.id;
    const btns = $("qOpts").children;
    q.options.forEach((o, j) => {
      btns[j].disabled = true;
      if (o.id === q.target.id) btns[j].classList.add("ok");
      else if (j === i) btns[j].classList.add("bad");
      else btns[j].classList.add("dim");
    });
    const fb = $("qFeedback");
    if (right) {
      score++; fb.textContent = "¡Correcto!"; fb.className = "feedback ok";
      delete missed[q.target.id];
    } else {
      fb.textContent = `${q.target.es} = ${q.target.en}`; fb.className = "feedback bad";
      missed[q.target.id] = (missed[q.target.id] || 0) + 1;
    }
    store.set("es1000.missed", missed);
    $("qScore").textContent = `${score} correct`;
    const next = $("nextBtn");
    next.textContent = qi === quiz.length - 1 ? "See results" : "Next";
    next.classList.remove("hidden"); next.focus({ preventScroll: true });
  }

  function nextQuestion() {
    if (quiz[qi].answer === null) return;
    if (qi < quiz.length - 1) { qi++; renderQuestion(); }
    else finish();
  }

  function finish() {
    const pct = Math.round(100 * score / quiz.length);
    history.quizzes++; history.answered += quiz.length; history.correct += score;
    history.best = Math.max(history.best, pct);
    store.set("es1000.history", history);
    $("rScore").innerHTML = `${score}<small> / ${quiz.length}</small>`;
    $("rVerdict").textContent = pct === 100 ? "¡Perfecto! Every one right." :
      pct >= 85 ? "¡Muy bien! Excellent work." : pct >= 65 ? "¡Bien! Solid — review the misses below." :
      pct >= 40 ? "Getting there. Retry the misses to lock them in." : "Keep going — try a smaller range first.";
    const wrong = quiz.filter(q => q.answer.id !== q.target.id);
    $("rMissedCard").classList.toggle("hidden", !wrong.length);
    $("retryMissedBtn").classList.toggle("hidden", !wrong.length);
    $("rMissed").innerHTML = wrong.map(q =>
      `<tr><td class="es">${esc(q.target.es)}</td><td>${esc(q.target.en)}<div class="yourans">you chose: ${esc(q.dir === "es-en" ? q.answer.en : q.answer.es)}</div></td><td class="pos">${POS_LABEL[q.target.pos]}</td></tr>`).join("");
    $("retryMissedBtn").onclick = () => startQuiz(wrong.map(q => q.target));
    show("results");
  }

  // ---------- browse ----------
  function renderBrowse() {
    const term = $("search").value.trim().toLowerCase();
    const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const t = norm(term);
    const list = t ? words.filter(w => norm(w.es).includes(t) || norm(w.en).includes(t)) : words;
    $("wordTable").innerHTML = list.length ? list.map(w =>
      `<tr><td class="n">${w.id}</td><td class="es">${esc(w.es)}</td><td>${esc(w.en)}</td><td class="pos">${POS_LABEL[w.pos]}</td></tr>`).join("")
      : `<tr><td class="empty">No matches</td></tr>`;
  }

  // ---------- wiring ----------
  $("rangeSeg").onclick = e => { const b = e.target.closest("button"); if (b) { settings.range = b.dataset.r; renderSetup(); } };
  $("dirSeg").onclick = e => { const b = e.target.closest("button"); if (b) { settings.dir = b.dataset.d; renderSetup(); } };
  $("countSeg").onclick = e => { const b = e.target.closest("button"); if (b) { settings.count = +b.dataset.c; renderSetup(); } };
  $("rFrom").onchange = e => { settings.from = +e.target.value; renderSetup(); };
  $("rTo").onchange = e => { settings.to = +e.target.value; renderSetup(); };
  $("startBtn").onclick = () => startQuiz("new");
  $("reviewBtn").onclick = () => startQuiz("missed");
  $("nextBtn").onclick = nextQuestion;
  $("quitBtn").onclick = () => { show("setup"); renderSetup(); };
  $("againBtn").onclick = () => startQuiz(lastStart === "missed" ? "missed" : "new");
  $("homeBtn").onclick = () => { show("setup"); renderSetup(); };
  $("navBrowse").onclick = () => { show("browse"); renderBrowse(); };
  $("navHome").onclick = () => { show("setup"); renderSetup(); };
  $("search").oninput = renderBrowse;
  document.addEventListener("keydown", e => {
    if ($("quiz").classList.contains("hidden")) return;
    if (e.key >= "1" && e.key <= "4") answer(+e.key - 1);
    else if (e.key === "Enter" && document.activeElement?.tagName !== "BUTTON" && quiz[qi] && quiz[qi].answer !== null) { e.preventDefault(); nextQuestion(); }
  });

  renderSetup();
})();
