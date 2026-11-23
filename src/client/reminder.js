/**
 * Reminder levels and the per-Session latch that keeps one level to one dialog.
 *
 * Occupancy starts to matter at the configured start — 25% unless the profile
 * says otherwise — and then again every further step, ten points by default
 * (35, 45, …). "Later" only silences the level that was shown: the next level
 * still raises a fresh reminder. Falling back below the start — a compaction,
 * a new Session, a cleared history — releases the latch, so climbing back up
 * starts the ladder over.
 *
 * Pure data and arithmetic: no React, no DOM, so the ladder can be tested
 * without a browser.
 */

/** The start used when the profile does not override it. */
export const DEFAULT_START_PERCENT = 25

/** The step used when the profile does not override it. */
export const DEFAULT_STEP_PERCENT = 10

/** The ladder used when the profile offers no usable settings. */
export const DEFAULT_LIMITS = Object.freeze({
  startPercent: DEFAULT_START_PERCENT,
  stepPercent: DEFAULT_STEP_PERCENT,
})

/**
 * The ladder step a given occupancy belongs to.
 *
 * Steps are counted from the start rather than from zero, so a start that is
 * not a multiple of the step still produces a ladder that begins exactly at
 * the start.
 * @param {number} percent - integer occupancy, 0 to 100.
 * @param {{ startPercent: number, stepPercent: number }} [limits] - the ladder in force.
 * @returns {number | null} the step, or null below the start.
 */
export function reminderLevel(percent, limits = DEFAULT_LIMITS) {
  if (!Number.isFinite(percent) || percent < limits.startPercent) return null
  return limits.startPercent
    + Math.floor((percent - limits.startPercent) / limits.stepPercent) * limits.stepPercent
}

/** Highest level already shown, per Session. Module-scoped: one latch for every mount. */
const latches = new Map()

/**
 * The level already shown for one Session.
 * @param {string} sessionId - Session identity.
 * @returns {number | null} that level, or null when nothing has been shown.
 */
export function shownLevel(sessionId) {
  return latches.get(sessionId) ?? null
}

/**
 * Forget one Session's latch.
 * @param {string} sessionId - Session identity.
 */
export function forgetSession(sessionId) {
  latches.delete(sessionId)
}

/**
 * Decide whether this check raises a reminder, latching the level when it does.
 * Latching on raise — not on dismissal — is what keeps a dialog from reopening
 * on every projection frame while the same level is on screen.
 * @param {string} sessionId - Session identity.
 * @param {number | null} percent - occupancy just read, or null while unknown.
 * @param {{ startPercent: number, stepPercent: number }} [limits] - the ladder in force.
 * @returns {{ level: number, percent: number } | null} the reminder to show.
 */
export function dueReminder(sessionId, percent, limits = DEFAULT_LIMITS) {
  if (percent === null) return null
  const level = reminderLevel(percent, limits)
  if (level === null) {
    forgetSession(sessionId)
    return null
  }
  const shown = shownLevel(sessionId)
  if (shown !== null && level <= shown) return null
  latches.set(sessionId, level)
  return { level, percent }
}

/**
 * Occupancy exactly as the composer's ring reports it: the projection's
 * projected figure when present, rounded to whole percent and capped at 100.
 * @param {{ projectedTokens?: number, pressureTokens?: number, contextWindow?: number } | undefined} pressure
 * - the `contextPressure` projection value.
 * @returns {number | null} occupancy, or null until both sides are known.
 */
export function occupancyPercent(pressure) {
  const used = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (used === undefined || pressure?.contextWindow === undefined || pressure.contextWindow <= 0) return null
  return Math.min(100, Math.round(used / pressure.contextWindow * 100))
}
