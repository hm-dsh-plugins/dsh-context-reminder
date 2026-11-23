/**
 * Checks the reminder ladder, the settings it reads, then loads the built
 * browser bundle outside a browser and runs its `apply()` against a stub
 * context.
 *
 * The ladder check covers the rule the feature exists for: the configured start
 * raises the first reminder, declining silences only that level, and falling
 * back below the start re-arms it. A second ladder proves the arithmetic does
 * not assume the default 25/10. The bundle check catches the wiring mistake
 * that would otherwise be silent — a plugin that loads but registers no seat,
 * or a seat that never got its settings reader.
 */
import assert from 'node:assert/strict'

import {
  DEFAULT_LIMITS, dueReminder, forgetSession, occupancyPercent, reminderLevel, shownLevel,
} from '../src/client/reminder.js'
import { limitsFrom, loadLimits } from '../src/client/config.js'

// The default ladder.
assert.equal(reminderLevel(5), null)
assert.equal(reminderLevel(24), null)
assert.equal(reminderLevel(25), 25)
assert.equal(reminderLevel(34), 25)
assert.equal(reminderLevel(35), 35)
assert.equal(reminderLevel(42), 35)
assert.equal(reminderLevel(100), 95)

// A ladder that is not the default: steps count from the start, not from zero.
const custom = { startPercent: 50, stepPercent: 5 }
assert.equal(reminderLevel(49, custom), null)
assert.equal(reminderLevel(52, custom), 50)
assert.equal(reminderLevel(55, custom), 55)
assert.equal(reminderLevel(60, custom), 60)
assert.equal(reminderLevel(99, { startPercent: 99, stepPercent: 1 }), 99)

// Settings: valid values pass through, the rest fall back to the defaults.
assert.deepEqual(limitsFrom({ startPercent: 40, stepPercent: 5 }), { startPercent: 40, stepPercent: 5 })
assert.deepEqual(limitsFrom({ startPercent: 33.6, stepPercent: 2.4 }), { startPercent: 34, stepPercent: 2 })
assert.deepEqual(limitsFrom({}), DEFAULT_LIMITS)
assert.deepEqual(limitsFrom(undefined), DEFAULT_LIMITS)
assert.deepEqual(limitsFrom({ startPercent: '40', stepPercent: null }), DEFAULT_LIMITS)
assert.deepEqual(limitsFrom({ startPercent: 0, stepPercent: 0 }), { startPercent: 1, stepPercent: 1 })
assert.deepEqual(limitsFrom({ startPercent: 200, stepPercent: 999 }), { startPercent: 99, stepPercent: 50 })

// Reading the profile: this plugin's namespace is used, anything else is not.
const settingsStub = (namespaces) => ({
  remote: { settings: { describe: async () => ({ ok: true, value: { namespaces } }) } },
})
assert.deepEqual(
  await loadLimits(settingsStub([{ ns: 'dsh-context-reminder', value: { startPercent: 40, stepPercent: 5 } }])),
  { startPercent: 40, stepPercent: 5 },
)
assert.deepEqual(
  await loadLimits(settingsStub([{ ns: 'someone-else', value: { startPercent: 80, stepPercent: 1 } }])),
  DEFAULT_LIMITS,
)
assert.deepEqual(
  await loadLimits({ remote: { settings: { describe: async () => ({ ok: false, error: { message: 'unavailable' } }) } } }),
  DEFAULT_LIMITS,
)
assert.deepEqual(
  await loadLimits({ remote: { settings: { describe: async () => { throw new Error('offline') } } } }),
  DEFAULT_LIMITS,
)

// Occupancy mirrors the composer ring: projected first, then pressure, capped.
assert.equal(occupancyPercent({ pressureTokens: 32_000, projectedTokens: 6_000, contextWindow: 128_000 }), 5)
assert.equal(occupancyPercent({ pressureTokens: 32_000, contextWindow: 128_000 }), 25)
assert.equal(occupancyPercent({ pressureTokens: 300_000, contextWindow: 128_000 }), 100)
assert.equal(occupancyPercent({ pressureTokens: 32_000 }), null)
assert.equal(occupancyPercent({ contextWindow: 128_000 }), null)
assert.equal(occupancyPercent(undefined), null)

// One Session: every further 10% asks again, and only then.
forgetSession('s1')
assert.equal(dueReminder('s1', 12), null)
assert.deepEqual(dueReminder('s1', 26), { level: 25, percent: 26 })
assert.equal(dueReminder('s1', 33), null, 'same level must not reopen the dialog')
assert.deepEqual(dueReminder('s1', 41), { level: 35, percent: 41 })
assert.equal(dueReminder('s1', 42), null)
assert.deepEqual(dueReminder('s1', 52), { level: 45, percent: 52 })
assert.equal(dueReminder('s1', null), null)

// A compaction (or a cleared history) drops below the start and re-arms the ladder.
assert.equal(dueReminder('s1', 12), null)
assert.equal(shownLevel('s1'), null)
assert.deepEqual(dueReminder('s1', 26), { level: 25, percent: 26 })

// Sessions latch independently, and each ladder is judged on its own start.
forgetSession('s2')
forgetSession('s3')
assert.equal(shownLevel('s2'), null)
assert.deepEqual(dueReminder('s2', 30), { level: 25, percent: 30 })
assert.deepEqual(dueReminder('s1', 41), { level: 35, percent: 41 })
assert.equal(dueReminder('s3', 40, custom), null)
assert.deepEqual(dueReminder('s3', 52, custom), { level: 50, percent: 52 })

// --- the built bundle ------------------------------------------------------

const loaded = []
globalThis.window = { __ModuleLoader__: { load: (definition) => loaded.push(definition) } }

const react = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  cloneElement: (element) => element,
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef: (initial) => ({ current: typeof initial === 'function' ? initial() : initial }),
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useId: () => 'id',
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
  Fragment: Symbol('Fragment'),
}
const jsx = react.createElement
const jsxRuntime = { jsx, jsxs: jsx, jsxDEV: jsx, Fragment: react.Fragment }

const primitives = {
  Modal: (props) => props.children,
  Button: (props) => props.children,
}

globalThis.document = {
  body: null,
  documentElement: { nodeType: 1 },
  head: { append() {} },
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
  querySelectorAll: () => [],
}

await import('../lib/client.js')

const definition = loaded[0]
assert.notEqual(definition, undefined, 'the bundle registered no module definition')

const module = definition.factory((name) => {
  if (name === 'react') return react
  if (name === 'react/jsx-runtime' || name === 'react/jsx-dev-runtime') return jsxRuntime
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return primitives
  throw new Error(`unexpected platform module: ${name}`)
})

const disposers = []
const registered = []
const ctx = {
  effect: (fn) => { disposers.push(fn()) },
  locale: { bind: () => (key) => key, register: () => () => {} },
  slots: {
    inject: (_name, callback) => { callback(); return () => {} },
    register: (entry, component) => { registered.push({ entry, component }); return () => {} },
  },
  remote: {
    commands: {
      execute: async () => ({ ok: true, value: { result: { kind: 'success' } } }),
    },
    settings: {
      describe: async () => ({ ok: true, value: { namespaces: [] } }),
    },
  },
}

module.apply(ctx)

for (const dispose of disposers) if (typeof dispose === 'function') dispose()

assert.equal(registered.length, 1, `unexpected registrations: ${JSON.stringify(registered.map(({ entry }) => entry))}`)
const [{ entry, component }] = registered
assert.equal(entry.name, 'conversation.composer.dock')
assert.equal(entry.id, 'dsh-context-reminder')
assert.equal(entry.locale, 'dshContextReminder')
assert.equal(typeof component, 'function')
assert.equal(typeof entry.inject, 'function')

const injected = entry.inject()
assert.equal(typeof injected.compact, 'function')
assert.equal(typeof injected.limits, 'function')
assert.deepEqual(await injected.limits(), DEFAULT_LIMITS, 'an unreadable profile must keep the defaults')

console.log(`smoke OK — ${definition.id}, ladder 25/35/45, ${registered.length} registration, teardown OK`)
