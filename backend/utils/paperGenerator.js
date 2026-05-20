/**
 * paperGenerator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise Dynamic Assessment Engine — Paper Generation Algorithm
 *
 * Generates a FROZEN attempt paper snapshot for a student.
 * Pure function — no DB calls, no side effects. Fully unit-testable.
 *
 * Algorithm:
 *  1. Take the master question pool from quiz.questions
 *  2. Randomly select N questions (questionsPerStudent) using Fisher-Yates
 *  3. Optionally shuffle the selected question ORDER (shuffleQuestions)
 *  4. Optionally shuffle each question's OPTIONS (shuffleOptions),
 *     tracking the new position of the correct answer
 *  5. Return an attemptPaper[] snapshot with all data frozen
 *
 * The snapshot is stored on Assignment.attemptPaper and NEVER regenerated
 * after the exam starts (refresh/reconnect restores from this snapshot).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * Fisher-Yates in-place shuffle.
 * Returns the same array (mutated) for convenience.
 * @param {Array} arr
 * @returns {Array}
 */
function fisherYatesShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Select n unique random elements from arr without modifying the original.
 * Uses partial Fisher-Yates — O(n) time, no duplicates by construction.
 * @param {Array} arr  - Source array
 * @param {number} n   - Number to select (must be ≤ arr.length)
 * @returns {Array}    - New array of n unique elements
 */
function selectRandom(arr, n) {
  const copy = [...arr]; // shallow clone — do NOT mutate original pool
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Normalize a correctAnswer value (from the master pool) into a numeric index.
 * The master pool stores correctAnswer as a string that is either:
 *   - A numeric index string: "0", "1", "2" …
 *   - A letter: "A", "B", "C" …  (some import paths)
 *   - The option text itself (rare legacy case)
 *
 * Returns a 0-based integer index into the options array, or 0 on parse failure.
 * @param {string|number} correctAnswer
 * @param {string[]} options
 * @returns {number}
 */
function resolveCorrectIndex(correctAnswer, options) {
  if (correctAnswer === null || correctAnswer === undefined) return 0;

  const raw = correctAnswer.toString().trim();

  // Numeric index
  const asNum = parseInt(raw, 10);
  if (!isNaN(asNum) && asNum >= 0 && asNum < options.length) return asNum;

  // Single letter (A-Z)
  if (/^[A-Za-z]$/.test(raw)) {
    const idx = raw.toUpperCase().charCodeAt(0) - 65; // 'A'=0, 'B'=1 ...
    if (idx >= 0 && idx < options.length) return idx;
  }

  // Full option text match (case-insensitive)
  const textIdx = options.findIndex(
    opt => opt && String(opt).trim().toUpperCase() === raw.toUpperCase()
  );
  if (textIdx !== -1) return textIdx;

  // Fallback
  return 0;
}

/**
 * Generate a frozen attempt paper for a student.
 *
 * @param {Object} quiz - Mongoose Quiz document (with .questions populated)
 * @returns {Array}  attemptPaper — array of snapshot items ready to save on Assignment
 *
 * Each snapshot item:
 * {
 *   questionId:      string  — original _id from master pool
 *   questionText:    string  — question text
 *   imageUrl:        string  — optional image
 *   shuffledOptions: string[] — options in the order shown to student
 *   correctAnswer:   string  — index (0-based, stored as string) into shuffledOptions
 *   displayedOrder:  number  — 0-based position on student's paper
 * }
 */
function generatePaper(quiz) {
  const pool = quiz.questions;

  if (!pool || pool.length === 0) {
    throw new Error('Quiz has no questions in the master pool.');
  }

  // ── Step 1: Determine how many questions to deliver ───────────────────────
  const n = (quiz.questionsPerStudent && quiz.questionsPerStudent > 0)
    ? quiz.questionsPerStudent
    : pool.length;

  if (n > pool.length) {
    throw new Error(
      `questionsPerStudent (${n}) exceeds master pool size (${pool.length}). ` +
      `Please reduce questionsPerStudent or add more questions.`
    );
  }

  // ── Step 2: Randomly select N unique questions from pool ──────────────────
  // selectRandom uses partial Fisher-Yates — no duplicates by construction.
  const selected = selectRandom(pool, n);

  // ── Step 3: Optionally shuffle the question ORDER ─────────────────────────
  if (quiz.shuffleQuestions) {
    fisherYatesShuffle(selected);
  }

  // ── Step 4 & 5: Build snapshot, optionally shuffle options per question ───
  const attemptPaper = selected.map((q, displayedOrder) => {
    const originalOptions = q.options.map(String); // clone as strings
    const correctIdx = resolveCorrectIndex(q.correctAnswer, originalOptions);

    let shuffledOptions;
    let newCorrectIdx;

    if (quiz.shuffleOptions) {
      // Create index array [0,1,2,3], shuffle it, then reorder options accordingly
      const indices = originalOptions.map((_, i) => i);
      fisherYatesShuffle(indices);
      shuffledOptions = indices.map(i => originalOptions[i]);
      // Find where the correct option ended up after shuffle
      newCorrectIdx = indices.indexOf(correctIdx);
    } else {
      shuffledOptions = [...originalOptions];
      newCorrectIdx = correctIdx;
    }

    return {
      questionId:      q._id.toString(),
      questionText:    q.question,
      imageUrl:        q.imageUrl || '',
      shuffledOptions,
      correctAnswer:   String(newCorrectIdx), // stored as string, consistent with existing Submission schema
      displayedOrder,
    };
  });

  return attemptPaper;
}

module.exports = { generatePaper, resolveCorrectIndex, fisherYatesShuffle };
