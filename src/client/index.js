/**
 * Browser half of `dsh-context-reminder`.
 *
 * One empty seat at the bottom of the composer watches the active Session.
 * When a turn finishes and the reported context occupancy reaches 25%, it
 * offers to compact; declining only silences that level, and every further
 * 10% (35, 45, …) asks again. The seat draws nothing until one of those
 * moments.
 */
import { ContextReminder } from './ContextReminder.jsx'
import { loadLimits } from './config.js'
import { en, zh } from './locales.js'

export const name = 'dsh-context-reminder'

/** This package's copy namespace. */
const NS = 'dshContextReminder'

/**
 * The client services this plugin reaches for. Every one must be injected,
 * not merely used: cordis resolves a service on `ctx` only for fibers that
 * declare it, and declaring also makes load order irrelevant.
 */
export const inject = ['slots', 'locale', 'remote', 'remote.commands', 'remote.settings']

/**
 * Run `/compact` for one Session through the Host command plane.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the client root context.
 * @param {string} sessionId - the Session to compact.
 * @returns {Promise<string | null>} failure copy, or null once the Host
 * accepted the command.
 */
async function compactContext(ctx, sessionId) {
  try {
    const result = await ctx.remote.commands.execute(sessionId, '/compact', [])
    if (!result.ok) return result.error.message
    if (result.value === undefined) return 'unknown command: /compact'
    return result.value.result.kind === 'error' ? result.value.result.text : null
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause)
  }
}

/**
 * Client plugin body: the dictionaries behind every label, and the reminder
 * seat that draws them.
 * @param {import('@deepseek-ai/cordis').Context} ctx - the client root context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${name}: dictionaries`)

  // One function each, defined once: the seat's props stay identical across
  // renders, so its effects do not restart on every projection frame.
  const compact = (sessionId) => compactContext(ctx, sessionId)
  const limits = () => loadLimits(ctx)

  ctx.effect(() => ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register(
    {
      name: 'conversation.composer.dock',
      id: name,
      locale: NS,
      inject: () => ({ compact, limits }),
    },
    ContextReminder,
  )), `${name}: reminder seat`)
}
