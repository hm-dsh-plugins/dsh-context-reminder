/**
 * Checks the reminder ladder, then loads the built browser bundle outside a
 * browser and runs its `apply()` against a stub context.
 *
 * The ladder check covers the rule the feature exists for: 25% raises the
 * first reminder, declining silences only that level, and falling back below
 * 25% re-arms it. The bundle check catches the wiring mistake that would
 * otherwise be silent — a plugin that loads but registers no seat.
 */
import assert from 'node:assert/strict'

import {
  dueReminder, forgetSession, occupancyPercent, reminderLevel, shownLevel,
} from '../src/client/reminder.js'

// The ladder itself.
assert.equal(reminderLevel(5), null)
assert.equal(reminderLevel(24), null)
assert.equal(reminderLevel(25), 25)
assert.equal(reminderLevel(34), 25)
assert.equal(reminderLevel(35), 35)
assert.equal(reminderLevel(42), 35)
assert.equal(reminderLevel(100), 95)

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

// A compaction (or a cleared history) drops below 25% and re-arms the ladder.
assert.equal(dueReminder('s1', 12), null)
assert.equal(shownLevel('s1'), null)
assert.deepEqual(dueReminder('s1', 26), { level: 25, percent: 26 })

// Sessions latch independently.
forgetSession('s2')
assert.equal(shownLevel('s2'), null)
assert.deepEqual(dueReminder('s2', 30), { level: 25, percent: 30 })
assert.deepEqual(dueReminder('s1', 41), { level: 35, percent: 41 })

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
assert.equal(typeof entry.inject().compact, 'function')

console.log(`smoke OK — ${definition.id}, ladder 25/35/45, ${registered.length} registration, teardown OK`)
