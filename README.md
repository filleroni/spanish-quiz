# Español 1000 — Spanish vocabulary quiz

A small, dependency-free web app for drilling the 1,000 most frequent Spanish words.

- **Quizzes of 10/20/30/50 multiple-choice questions** (20 by default)
- **Range by frequency rank**: top 100, 250, 500, all 1000, or a custom range
- **Direction**: Spanish → English, English → Spanish, or mixed
- **Reasonable distractors**: wrong answers have the same part of speech, are close in frequency, and are never synonyms of the right answer
- **Review mode**: words you miss are remembered (in your browser) until you get them right
- **Word list**: searchable list of all 1000 words
- **Verb conjugation mode**: type the right form of 79 common verbs (regular, stem-changing and irregular)
  across 8 tenses — present, preterite, imperfect, future, conditional, present perfect, present and
  imperfect subjunctive. Choose tenses, verb set (top 20/40/all), whether to include *vosotros*, and
  whether accents must be exact. After each answer the whole tense is shown. Conjugations are generated
  by the engine in `verbs.js`.

Words are lemmas (dictionary forms), ranked using spoken-Spanish frequency data from
[FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles corpus).
Data lives in `words.js` as `[spanish, partOfSpeech, english]`, in rank order.

Run locally by opening `index.html` in a browser. Keyboard: `1`–`4` to answer, `Enter` for next.
