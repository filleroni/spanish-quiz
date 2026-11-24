// Spanish conjugation engine + list of common verbs (in rough frequency order).
// Regular patterns are generated; stem changes, spelling changes and irregular
// forms are declared per verb.
const Conj = (() => {
  "use strict";

  const PERSONS = [
    { es: "yo", en: "I" },
    { es: "tú", en: "you" },
    { es: "él / ella / usted", en: "he / she / you (formal)" },
    { es: "nosotros", en: "we" },
    { es: "vosotros", en: "you all (Spain)" },
    { es: "ellos / ustedes", en: "they / you all" },
  ];

  const TENSES = [
    { id: "pres", es: "Presente", en: "present" },
    { id: "pret", es: "Pretérito indefinido", en: "simple past (preterite)" },
    { id: "impf", es: "Pretérito imperfecto", en: "past habitual (imperfect)" },
    { id: "fut", es: "Futuro", en: "future" },
    { id: "cond", es: "Condicional", en: "conditional (would)" },
    { id: "perf", es: "Pretérito perfecto", en: "present perfect (have done)" },
    { id: "subj", es: "Presente de subjuntivo", en: "present subjunctive" },
    { id: "isubj", es: "Imperfecto de subjuntivo", en: "imperfect subjunctive" },
  ];

  // ch: stem change in the present ('ie', 'ue', 'i'); for -ir verbs this also
  //     gives e→i / o→u in the preterite 3rd persons and subjunctive nos/vos.
  // yo: irregular yo stem in the present (also used for the whole subjunctive).
  // fut: irregular future/conditional stem.  pret: strong preterite stem.
  // part: irregular participle.  acc: accent on the stem i/u (envío, continúo).
  // y: -uir verbs (construyo).  o: full overrides per tense (array of 6).
  const V = [
    { inf: "ser", en: "to be (essential)", part: "sido", o: {
      pres: ["soy", "eres", "es", "somos", "sois", "son"],
      pret: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
      impf: ["era", "eras", "era", "éramos", "erais", "eran"],
      subj: ["sea", "seas", "sea", "seamos", "seáis", "sean"] } },
    { inf: "estar", en: "to be (state, location)", pret: "estuv", o: {
      pres: ["estoy", "estás", "está", "estamos", "estáis", "están"],
      subj: ["esté", "estés", "esté", "estemos", "estéis", "estén"] } },
    { inf: "tener", en: "to have", ch: "ie", yo: "teng", fut: "tendr", pret: "tuv" },
    { inf: "hacer", en: "to do, to make", yo: "hag", fut: "har", part: "hecho", o: {
      pret: ["hice", "hiciste", "hizo", "hicimos", "hicisteis", "hicieron"] } },
    { inf: "poder", en: "to be able to, can", ch: "ue", fut: "podr", pret: "pud" },
    { inf: "decir", en: "to say, to tell", ch: "i", yo: "dig", fut: "dir", pret: "dij", part: "dicho" },
    { inf: "ir", en: "to go", o: {
      pres: ["voy", "vas", "va", "vamos", "vais", "van"],
      pret: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"],
      impf: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"],
      subj: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"] } },
    { inf: "ver", en: "to see", part: "visto", o: {
      pres: ["veo", "ves", "ve", "vemos", "veis", "ven"],
      pret: ["vi", "viste", "vio", "vimos", "visteis", "vieron"],
      impf: ["veía", "veías", "veía", "veíamos", "veíais", "veían"],
      subj: ["vea", "veas", "vea", "veamos", "veáis", "vean"] } },
    { inf: "dar", en: "to give", o: {
      pres: ["doy", "das", "da", "damos", "dais", "dan"],
      pret: ["di", "diste", "dio", "dimos", "disteis", "dieron"],
      subj: ["dé", "des", "dé", "demos", "deis", "den"] } },
    { inf: "saber", en: "to know (facts)", fut: "sabr", pret: "sup", o: {
      pres: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"],
      subj: ["sepa", "sepas", "sepa", "sepamos", "sepáis", "sepan"] } },
    { inf: "querer", en: "to want, to love", ch: "ie", fut: "querr", pret: "quis" },
    { inf: "llegar", en: "to arrive" },
    { inf: "pasar", en: "to pass, to happen" },
    { inf: "deber", en: "must, to owe" },
    { inf: "poner", en: "to put", yo: "pong", fut: "pondr", pret: "pus", part: "puesto" },
    { inf: "parecer", en: "to seem", yo: "parezc" },
    { inf: "quedar", en: "to stay, to remain" },
    { inf: "creer", en: "to believe" },
    { inf: "hablar", en: "to speak, to talk" },
    { inf: "llevar", en: "to carry, to wear" },
    { inf: "dejar", en: "to leave, to let" },
    { inf: "seguir", en: "to follow, to continue", ch: "i", yo: "sig" },
    { inf: "encontrar", en: "to find", ch: "ue" },
    { inf: "llamar", en: "to call" },
    { inf: "venir", en: "to come", ch: "ie", yo: "veng", fut: "vendr", pret: "vin" },
    { inf: "pensar", en: "to think", ch: "ie" },
    { inf: "salir", en: "to go out, to leave", yo: "salg", fut: "saldr" },
    { inf: "volver", en: "to return", ch: "ue", part: "vuelto" },
    { inf: "tomar", en: "to take, to drink" },
    { inf: "conocer", en: "to know (people, places)", yo: "conozc" },
    { inf: "vivir", en: "to live" },
    { inf: "sentir", en: "to feel", ch: "ie" },
    { inf: "mirar", en: "to look at, to watch" },
    { inf: "contar", en: "to count, to tell", ch: "ue" },
    { inf: "empezar", en: "to begin", ch: "ie" },
    { inf: "esperar", en: "to wait, to hope" },
    { inf: "buscar", en: "to look for" },
    { inf: "entrar", en: "to enter" },
    { inf: "trabajar", en: "to work" },
    { inf: "escribir", en: "to write", part: "escrito" },
    { inf: "perder", en: "to lose", ch: "ie" },
    { inf: "entender", en: "to understand", ch: "ie" },
    { inf: "pedir", en: "to ask for, to order", ch: "i" },
    { inf: "recibir", en: "to receive" },
    { inf: "recordar", en: "to remember", ch: "ue" },
    { inf: "terminar", en: "to finish" },
    { inf: "abrir", en: "to open", part: "abierto" },
    { inf: "oír", en: "to hear", o: {
      pres: ["oigo", "oyes", "oye", "oímos", "oís", "oyen"],
      subj: ["oiga", "oigas", "oiga", "oigamos", "oigáis", "oigan"] } },
    { inf: "leer", en: "to read" },
    { inf: "caer", en: "to fall", yo: "caig" },
    { inf: "cambiar", en: "to change" },
    { inf: "traer", en: "to bring", yo: "traig", pret: "traj" },
    { inf: "morir", en: "to die", ch: "ue", part: "muerto" },
    { inf: "jugar", en: "to play (a game)", ch: "ue" },
    { inf: "pagar", en: "to pay" },
    { inf: "ayudar", en: "to help" },
    { inf: "comer", en: "to eat" },
    { inf: "beber", en: "to drink" },
    { inf: "dormir", en: "to sleep", ch: "ue" },
    { inf: "comprar", en: "to buy" },
    { inf: "aprender", en: "to learn" },
    { inf: "estudiar", en: "to study" },
    { inf: "cerrar", en: "to close", ch: "ie" },
    { inf: "preferir", en: "to prefer", ch: "ie" },
    { inf: "conducir", en: "to drive", yo: "conduzc", pret: "conduj" },
    { inf: "elegir", en: "to choose", ch: "i", yo: "elij" },
    { inf: "construir", en: "to build", y: true },
    { inf: "enviar", en: "to send", acc: true },
    { inf: "continuar", en: "to continue", acc: true },
    { inf: "vender", en: "to sell" },
    { inf: "correr", en: "to run" },
    { inf: "escuchar", en: "to listen" },
    { inf: "ganar", en: "to win, to earn" },
    { inf: "servir", en: "to serve", ch: "i" },
    { inf: "ofrecer", en: "to offer", yo: "ofrezc" },
    { inf: "producir", en: "to produce", yo: "produzc", pret: "produj" },
    { inf: "repetir", en: "to repeat", ch: "i" },
    { inf: "descubrir", en: "to discover", part: "descubierto" },
    { inf: "romper", en: "to break", part: "roto" },
  ];

  const END = {
    pres: { ar: ["o", "as", "a", "amos", "áis", "an"], er: ["o", "es", "e", "emos", "éis", "en"], ir: ["o", "es", "e", "imos", "ís", "en"] },
    pret: { ar: ["é", "aste", "ó", "amos", "asteis", "aron"], er: ["í", "iste", "ió", "imos", "isteis", "ieron"] },
    impf: { ar: ["aba", "abas", "aba", "ábamos", "abais", "aban"], er: ["ía", "ías", "ía", "íamos", "íais", "ían"] },
    fut: ["é", "ás", "á", "emos", "éis", "án"],
    cond: ["ía", "ías", "ía", "íamos", "íais", "ían"],
    subj: { ar: ["e", "es", "e", "emos", "éis", "en"], er: ["a", "as", "a", "amos", "áis", "an"] },
  };
  const BOOT = [0, 1, 2, 5]; // persons that take the stem change
  const HABER = ["he", "has", "ha", "hemos", "habéis", "han"];

  const stripAcc = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");

  function replaceLast(stem, from, to) {
    const i = stem.lastIndexOf(from);
    return i < 0 ? stem : stem.slice(0, i) + to + stem.slice(i + 1);
  }
  function changeStem(stem, ch, inf) {
    if (ch === "ie") return replaceLast(stem, "e", "ie");
    if (ch === "i") return replaceLast(stem, "e", "i");
    if (ch === "ue") return inf === "jugar" ? replaceLast(stem, "u", "ue") : replaceLast(stem, "o", "ue");
    return stem;
  }
  // -ir stem-changers: e→i, o→u (preterite 3rd persons, subjunctive nos/vos)
  const weakStem = stem => stem.includes("o") ? replaceLast(stem, "o", "u") : replaceLast(stem, "e", "i");
  const accStem = stem => /i$/.test(stem) ? stem.slice(0, -1) + "í" : stem.slice(0, -1) + "ú";
  // c→qu, g→gu, z→c before e (busqué, llegue, empiece)
  const softE = stem => stem.replace(/c$/, "qu").replace(/g$/, "gu").replace(/z$/, "c");

  function conjugate(v) {
    const inf = v.inf, cls = stripAcc(inf).slice(-2), stem = stripAcc(inf).slice(0, -2);
    const isIr = cls === "ir", erir = cls === "ar" ? "ar" : "er";
    const vowelStem = /[aeo]$/.test(stem) && cls !== "ar"; // leer, creer, caer, traer, oír
    const T = {};

    // Present
    T.pres = END.pres[cls].map((e, p) => {
      let s = stem;
      if (v.ch && BOOT.includes(p)) s = changeStem(s, v.ch, inf);
      if (v.acc && BOOT.includes(p)) s = accStem(s);
      if (v.y && BOOT.includes(p)) s = s + "y";
      if (p === 0 && v.yo) s = v.yo;
      return s + e;
    });

    // Preterite
    if (v.pret) {
      const j = v.pret.endsWith("j");
      T.pret = ["e", "iste", "o", "imos", "isteis", j ? "eron" : "ieron"].map(e => v.pret + e);
    } else {
      T.pret = END.pret[erir].map((e, p) => {
        let s = stem;
        if (cls === "ar" && p === 0) s = softE(s);
        if (isIr && v.ch && (p === 2 || p === 5)) s = weakStem(s);
        if ((vowelStem || v.y) && (p === 2 || p === 5)) return s + (p === 2 ? "yó" : "yeron");
        if (vowelStem) e = e.replace(/^i/, "í");
        return s + e;
      });
    }

    T.impf = END.impf[erir].map(e => stem + e);
    const fstem = v.fut || stripAcc(inf);
    T.fut = END.fut.map(e => fstem + e);
    T.cond = END.cond.map(e => fstem + e);

    // Participle + present perfect
    const part = v.part || stem + (cls === "ar" ? "ado" : vowelStem ? "ído" : "ido");
    T.perf = HABER.map(h => h + " " + part);

    // Present subjunctive (from the yo stem)
    T.subj = END.subj[erir].map((e, p) => {
      let s;
      if (v.yo) s = v.yo;
      else if (v.y) s = stem + "y";
      else {
        s = stem;
        if (v.ch && BOOT.includes(p)) s = changeStem(s, v.ch, inf);
        else if (v.ch && isIr) s = weakStem(s);
        if (v.acc && BOOT.includes(p)) s = accStem(s);
      }
      if (cls === "ar") s = softE(s);
      return s + e;
    });

    Object.assign(T, v.o || {});

    // Imperfect subjunctive (from the preterite 'ellos' form)
    const base = T.pret[5].slice(0, -3); // hablaron → habla
    T.isubj = ["ra", "ras", "ra", "ramos", "rais", "ran"].map((e, p) => {
      if (p !== 3) return base + e;
      const last = base.slice(-1); // stress the vowel before -ramos
      return base.slice(0, -1) + ({ a: "á", e: "é" }[last] || last) + e;
    });

    return { inf, en: v.en, part, forms: T };
  }

  const verbs = V.map(conjugate);
  return { PERSONS, TENSES, verbs, stripAcc };
})();
