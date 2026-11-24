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
  let settings = Object.assign({ mode: "vocab", range: "1-100", from: 1, to: 1000, dir: "es-en", count: 20,
    tenses: ["pres"], verbSet: "20", vosotros: false, strictAcc: false }, store.get("es1000.settings", {}));
  let missed = store.get("es1000.missed", {});   // id -> times missed (removed when answered right)
  let vmissed = store.get("es1000.vmissed", {}); // "inf|tense|person" -> times missed
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
    ["setup", "quiz", "vquiz", "results", "browse"].forEach(s => $(s).classList.toggle("hidden", s !== id));
    $("navBrowse").classList.toggle("hidden", id === "browse" || id === "quiz" || id === "vquiz");
    $("navHome").classList.toggle("hidden", id !== "browse");
    window.scrollTo(0, 0);
  }

  function renderSetup() {
    document.querySelectorAll("#rangeSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.r === settings.range));
    document.querySelectorAll("#dirSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.d === settings.dir));
    document.querySelectorAll("#countSeg button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.c === settings.count));
    $("customRow").classList.toggle("hidden", settings.range !== "custom");
    $("rFrom").value = settings.from; $("rTo").value = settings.to;
    document.querySelectorAll("#modeSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.m === settings.mode));
    const verbsMode = settings.mode === "verbs";
    $("vocabSetup").classList.toggle("hidden", verbsMode);
    $("verbSetup").classList.toggle("hidden", !verbsMode);
    document.querySelectorAll("#tenseSeg button").forEach(b => b.setAttribute("aria-pressed", settings.tenses.includes(b.dataset.t)));
    document.querySelectorAll("#verbSetSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === settings.verbSet));
    $("vosotros").checked = settings.vosotros; $("strictAcc").checked = settings.strictAcc;
    $("startBtn").textContent = verbsMode ? "Start verb quiz" : "Start quiz";
    $("startBtn").disabled = verbsMode && !settings.tenses.length;
    const nMissed = Object.keys(verbsMode ? vmissed : missed).length;
    const reviewBtn = $("reviewBtn");
    const noun = verbsMode ? "verb forms" : "words";
    reviewBtn.textContent = nMissed ? `Practise my missed ${noun} (${nMissed})` : `Practise my missed ${noun}`;
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
    $("rMissedTitle").textContent = "Words to review";
    $("rMissedCard").classList.toggle("hidden", !wrong.length);
    $("retryMissedBtn").classList.toggle("hidden", !wrong.length);
    $("rMissed").innerHTML = wrong.map(q =>
      `<tr><td class="es">${esc(q.target.es)}</td><td>${esc(q.target.en)}<div class="yourans">you chose: ${esc(q.dir === "es-en" ? q.answer.en : q.answer.es)}</div></td><td class="pos">${POS_LABEL[q.target.pos]}</td></tr>`).join("");
    $("retryMissedBtn").onclick = () => startQuiz(wrong.map(q => q.target));
    $("againBtn").onclick = () => startQuiz(lastStart === "missed" ? "missed" : "new");
    show("results");
  }

  // ---------- verb conjugation ----------
  const TENSE = Object.fromEntries(Conj.TENSES.map(t => [t.id, t]));
  const PRON = /^(yo|t[uú]|[eé]l|ella|usted|nosotr[oa]s|vosotr[oa]s|ellos|ellas|ustedes)\s+/;
  const normAns = s => s.trim().toLowerCase().replace(/\s+/g, " ").replace(PRON, "");
  let vq = [], vi = 0, vscore = 0, vLastStart = null;

  function alternatives(item) {
    const forms = [item.verb.forms[item.tense][item.p]];
    if (item.tense === "isubj") { // also accept the -se form (hablase)
      const ra = forms[0];
      forms.push(ra.replace(/ra(s|mos|is|n)?$/, (m, e) => "se" + (e || "")));
    }
    return forms;
  }

  function vStart(mode) {
    let items = [];
    if (mode === "missed") {
      items = Object.keys(vmissed).map(k => {
        const [inf, tense, p] = k.split("|");
        const verb = Conj.verbs.find(v => v.inf === inf);
        return verb && { verb, tense, p: +p };
      }).filter(Boolean);
      items = shuffle(items).slice(0, settings.count);
    } else if (Array.isArray(mode)) {
      items = shuffle(mode.map(x => ({ verb: x.verb, tense: x.tense, p: x.p })));
    } else {
      const n = settings.verbSet === "all" ? Conj.verbs.length : +settings.verbSet;
      const verbs = Conj.verbs.slice(0, n);
      const persons = settings.vosotros ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 5];
      const seen = new Set();
      let guard = 0;
      while (items.length < settings.count && guard++ < 5000) {
        const verb = verbs[Math.floor(Math.random() * verbs.length)];
        const tense = settings.tenses[Math.floor(Math.random() * settings.tenses.length)];
        const p = persons[Math.floor(Math.random() * persons.length)];
        const key = verb.inf + tense + p;
        // avoid repeats, and avoid the same verb twice in a row
        if (seen.has(key) || (items.length && items[items.length - 1].verb === verb)) continue;
        seen.add(key); items.push({ verb, tense, p });
      }
    }
    if (!items.length) return;
    vLastStart = mode;
    vq = items.map(it => Object.assign(it, { given: null, right: null }));
    vi = 0; vscore = 0;
    show("vquiz");
    vRender();
  }

  function vRender() {
    const it = vq[vi], t = TENSE[it.tense], per = Conj.PERSONS[it.p];
    $("vNum").textContent = `Question ${vi + 1} of ${vq.length}`;
    $("vScore").textContent = `${vscore} correct`;
    $("vBar").style.width = `${(vi / vq.length) * 100}%`;
    $("vTense").innerHTML = `<span>${esc(t.es)}</span>`;
    $("vVerb").textContent = it.verb.inf;
    $("vMeaning").textContent = `${it.verb.en} · ${t.en}`;
    $("vPerson").textContent = `${per.es}  (${per.en})`;
    const inp = $("vInput");
    inp.value = ""; inp.className = "answer"; inp.disabled = false;
    $("vCheck").classList.remove("hidden"); $("accents").classList.remove("hidden");
    $("vFeedback").textContent = ""; $("vFeedback").className = "feedback";
    $("vTable").classList.add("hidden");
    $("vNext").classList.add("hidden");
    inp.focus({ preventScroll: true });
  }

  function vCheck() {
    const it = vq[vi];
    if (it.given !== null) return;
    const raw = $("vInput").value;
    if (!raw.trim()) { $("vInput").focus(); return; }
    const given = normAns(raw);
    const alts = alternatives(it);
    const exact = alts.includes(given);
    const loose = !exact && alts.some(a => Conj.stripAcc(a) === Conj.stripAcc(given));
    const right = exact || (loose && !settings.strictAcc);
    it.given = raw.trim(); it.right = right;
    const key = `${it.verb.inf}|${it.tense}|${it.p}`;
    if (right) { vscore++; delete vmissed[key]; } else vmissed[key] = (vmissed[key] || 0) + 1;
    store.set("es1000.vmissed", vmissed);

    const inp = $("vInput"), fb = $("vFeedback"), correct = alts[0];
    inp.disabled = true; inp.classList.add(right ? "ok" : "bad");
    if (exact) { fb.textContent = "¡Correcto!"; fb.className = "feedback ok"; }
    else if (loose && right) { fb.textContent = `Correct — but watch the accent: ${correct}`; fb.className = "feedback ok"; }
    else if (loose) { fb.textContent = `Check the accent: ${correct}`; fb.className = "feedback bad"; }
    else { fb.textContent = `Answer: ${correct}`; fb.className = "feedback bad"; }

    // show the whole tense so the pattern sticks
    const forms = it.verb.forms[it.tense];
    const rows = Conj.PERSONS.map((per, p) => (p === 4 && !settings.vosotros && it.p !== 4) ? "" :
      `<tr class="${p === it.p ? "cur" : ""}"><td class="pos">${esc(per.es)}</td><td>${esc(forms[p])}</td></tr>`).join("");
    $("vTable").innerHTML = `<table>${rows}</table>`;
    $("vTable").classList.remove("hidden");
    $("vCheck").classList.add("hidden"); $("accents").classList.add("hidden");
    const next = $("vNext");
    next.textContent = vi === vq.length - 1 ? "See results" : "Next";
    next.classList.remove("hidden"); next.focus({ preventScroll: true });
    $("vScore").textContent = `${vscore} correct`;
  }

  function vNext() {
    if (vq[vi].given === null) return;
    if (vi < vq.length - 1) { vi++; vRender(); } else vFinish();
  }

  function vFinish() {
    const pct = Math.round(100 * vscore / vq.length);
    history.quizzes++; history.answered += vq.length; history.correct += vscore;
    history.best = Math.max(history.best, pct);
    store.set("es1000.history", history);
    $("rScore").innerHTML = `${vscore}<small> / ${vq.length}</small>`;
    $("rVerdict").textContent = pct === 100 ? "¡Perfecto! Every form right." :
      pct >= 85 ? "¡Muy bien! Excellent work." : pct >= 65 ? "¡Bien! Review the misses below." :
      pct >= 40 ? "Getting there. Retry the misses to lock them in." : "Keep going — try one tense at a time first.";
    const wrong = vq.filter(it => !it.right);
    $("rMissedTitle").textContent = "Forms to review";
    $("rMissedCard").classList.toggle("hidden", !wrong.length);
    $("retryMissedBtn").classList.toggle("hidden", !wrong.length);
    $("rMissed").innerHTML = wrong.map(it =>
      `<tr><td class="es">${esc(it.verb.inf)}</td><td>${esc(Conj.PERSONS[it.p].es.split(" /")[0])} <b>${esc(it.verb.forms[it.tense][it.p])}</b>
       <div class="yourans">you wrote: ${esc(it.given)}</div></td><td class="pos">${esc(TENSE[it.tense].en.split(" (")[0])}</td></tr>`).join("");
    $("retryMissedBtn").onclick = () => vStart(wrong);
    $("againBtn").onclick = () => vStart(vLastStart === "missed" ? "missed" : "new");
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
  $("tenseSeg").innerHTML = Conj.TENSES.map(t => `<button data-t="${t.id}">${esc(t.en.split(" (")[0].replace(/^./, c => c.toUpperCase()))}<br><small>${esc(t.es)}</small></button>`).join("");
  $("modeSeg").onclick = e => { const b = e.target.closest("button"); if (b) { settings.mode = b.dataset.m; renderSetup(); } };
  $("tenseSeg").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    const t = b.dataset.t, i = settings.tenses.indexOf(t);
    if (i >= 0) settings.tenses.splice(i, 1); else settings.tenses.push(t);
    renderSetup();
  };
  $("verbSetSeg").onclick = e => { const b = e.target.closest("button"); if (b) { settings.verbSet = b.dataset.v; renderSetup(); } };
  $("vosotros").onchange = e => { settings.vosotros = e.target.checked; renderSetup(); };
  $("strictAcc").onchange = e => { settings.strictAcc = e.target.checked; renderSetup(); };
  $("vForm").onsubmit = e => { e.preventDefault(); vCheck(); };
  $("vNext").onclick = vNext;
  $("vQuit").onclick = () => { show("setup"); renderSetup(); };
  $("accents").onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    const inp = $("vInput"), a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
    inp.value = inp.value.slice(0, a) + b.textContent + inp.value.slice(z);
    inp.focus(); inp.setSelectionRange(a + 1, a + 1);
  };
  $("startBtn").onclick = () => settings.mode === "verbs" ? vStart("new") : startQuiz("new");
  $("reviewBtn").onclick = () => settings.mode === "verbs" ? vStart("missed") : startQuiz("missed");
  $("nextBtn").onclick = nextQuestion;
  $("quitBtn").onclick = () => { show("setup"); renderSetup(); };
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
