/**
 * The ladder the profile asks for, and how the browser reads it.
 *
 * Both fields are declared volatile in the host half's Config, so the profile's
 * settings page owns them. The browser only reads: `settings.describe` reports
 * every namespace the Host registered, this plugin's among them, already
 * resolved against the schema defaults.
 *
 * A browser that cannot read the profile — Settings disabled, an older Host, a
 * failed call — keeps the defaults rather than guessing a different ladder, so
 * the reminder never silently switches to a range nobody asked for.
 */

import { DEFAULT_LIMITS } from './reminder.js'

/** This plugin's settings namespace: its profile entry id. */
const NS = 'dsh-context-reminder'

/**
 * Clamp one configured number into the range the settings form allows.
 * @param {unknown} value - the field as the Host reported it.
 * @param {number} fallback - value to keep when the field is missing or not a number.
 * @param {number} min - smallest accepted value.
 * @param {number} max - largest accepted value.
 * @returns {number} a whole number inside the range.
 */
function bounded(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

/**
 * Turn one settings value into a ladder, tolerating missing or out-of-range fields.
 * @param {{ startPercent?: unknown, stepPercent?: unknown } | undefined} value - the namespace's value.
 * @returns {{ startPercent: number, stepPercent: number }} the ladder to apply.
 */
export function limitsFrom(value) {
  return {
    startPercent: bounded(value?.startPercent, DEFAULT_LIMITS.startPercent, 1, 99),
    stepPercent: bounded(value?.stepPercent, DEFAULT_LIMITS.stepPercent, 1, 50),
  }
}

/**
 * Read this plugin's settings from the Host.
 * @param {import('@deepseek-ai/cordis').Context} ctx - client root context.
 * @returns {Promise<{ startPercent: number, stepPercent: number }>} the ladder in force.
 */
export async function loadLimits(ctx) {
  try {
    const answer = await ctx.remote.settings.describe()
    if (!answer.ok) return DEFAULT_LIMITS
    const row = answer.value.namespaces.find((entry) => entry.ns === NS)
    return limitsFrom(row?.value)
  } catch {
    return DEFAULT_LIMITS
  }
}
