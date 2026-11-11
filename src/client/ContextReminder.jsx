/**
 * The reminder seat: an invisible composer-dock entry that watches one
 * Session's turn boundary and its context occupancy.
 *
 * A turn has finished when the Session stops running. The seat only reacts
 * after it has observed a turn run, so merely opening an old conversation
 * raises nothing by itself. Occupancy comes from the same `contextPressure`
 * projection the composer's ring draws, so the figure in the dialog and the
 * figure on screen cannot disagree.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { dueReminder, occupancyPercent } from './reminder.js'

/**
 * The reminder seat.
 * @param props - the Session slot's standard props: `sessionId`, `useSession`
 * and `useProjection`, the bound `t` seat, and the injected `compact` action.
 * @returns the dialog while one is due; nothing the rest of the time.
 */
export function ContextReminder({ sessionId, t, useSession, useProjection, compact }) {
  const running = useSession(snapshot => snapshot.running)
  const pressure = useProjection('contextPressure')
  const percent = occupancyPercent(pressure)
  const [reminder, setReminder] = useState(null)
  const [compacting, setCompacting] = useState(false)
  const [failure, setFailure] = useState(null)
  // Only a turn boundary this seat actually saw may raise a reminder; a
  // conversation resumed at 60% is not a fresh reason to interrupt.
  const sawTurn = useRef(false)
  const latest = useRef(percent)
  latest.current = percent

  useEffect(() => {
    if (running) {
      sawTurn.current = true
      return
    }
    if (!sawTurn.current) return
    const due = dueReminder(sessionId, latest.current)
    if (due === null) return
    setReminder(due)
    setFailure(null)
  }, [running, percent, sessionId])

  const close = useCallback(() => {
    setReminder(null)
    setFailure(null)
  }, [])

  const compress = useCallback(async () => {
    if (reminder === null || compacting) return
    setCompacting(true)
    setFailure(null)
    const error = await compact(sessionId)
    setCompacting(false)
    if (error === null) setReminder(null)
    else setFailure(error)
  }, [compact, compacting, reminder, sessionId])

  if (reminder === null) return null

  return (
    <Modal
      open
      tone="warning"
      title={t('reminder.title', { percent: reminder.percent })}
      description={t('reminder.description')}
      closeLabel={t('reminder.close')}
      onClose={close}
      footer={(
        <>
          <Button variant="outline" onClick={close} disabled={compacting}>
            {t('reminder.later')}
          </Button>
          <Button variant="primary" onClick={compress} disabled={compacting} data-modal-autofocus>
            {compacting ? t('reminder.compacting') : t('reminder.compact')}
          </Button>
        </>
      )}
    >
      {failure !== null && (
        <p
          style={{
            margin: 0,
            color: 'var(--dsw-alias-state-error-primary)',
            fontSize: 13,
            lineHeight: '20px',
          }}
        >
          {t('reminder.failed', { reason: failure })}
        </p>
      )}
    </Modal>
  )
}
