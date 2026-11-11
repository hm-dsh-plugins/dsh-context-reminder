/**
 * `dshContextReminder` dictionaries.
 *
 * Simplified Chinese is the key set's source of truth; English is checked
 * against it by hand.
 */

/** Simplified Chinese dictionary. */
export const zh = {
  'reminder.title': '上下文已用 {percent}%',
  'reminder.description': '继续对话前建议先压缩上下文。压缩会把较早的对话整理成摘要，原文不再留在上下文里。',
  'reminder.compact': '压缩上下文',
  'reminder.compacting': '正在压缩…',
  'reminder.later': '暂不',
  'reminder.close': '关闭',
  'reminder.failed': '压缩失败：{reason}',
}

/** English dictionary. */
export const en = {
  'reminder.title': 'Context is {percent}% full',
  'reminder.description': 'Consider compacting before you continue. Compaction folds earlier turns into a summary, so the original exchanges no longer stay in context.',
  'reminder.compact': 'Compact context',
  'reminder.compacting': 'Compacting…',
  'reminder.later': 'Not now',
  'reminder.close': 'Close',
  'reminder.failed': 'Compaction failed: {reason}',
}
