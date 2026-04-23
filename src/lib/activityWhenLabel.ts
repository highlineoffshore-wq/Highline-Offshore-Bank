import type { ActivityRow } from '../types/banking'

function timestampMsFromActivityId(id: string): number {
  const adm = /^adm_(\d+)_/.exec(id)
  if (adm) {
    const n = Number(adm[1])
    return Number.isFinite(n) ? n : NaN
  }
  const legacy = /^(\d+)-/.exec(id)
  if (legacy) {
    const n = Number(legacy[1])
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

/**
 * Prefer ISO timestamps on the row so year and time always show, even if `dateLabel`
 * in persisted data is an older short string.
 */
export function formatActivityListDate(row: ActivityRow): string {
  const booked = typeof row.bookedAt === 'string' ? row.bookedAt.trim() : ''
  if (booked) {
    const ms = Date.parse(booked)
    if (!Number.isNaN(ms)) {
      return (
        new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          timeZone: 'UTC',
        }).format(new Date(ms)) + ' UTC'
      )
    }
  }
  const posted = typeof row.postedAt === 'string' ? row.postedAt.trim() : ''
  if (posted) {
    const ms = Date.parse(posted)
    if (!Number.isNaN(ms)) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(ms))
    }
  }
  const idMs = timestampMsFromActivityId(row.id)
  if (!Number.isNaN(idMs) && idMs >= Date.UTC(2000, 0, 1)) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date(idMs))
  }
  return row.dateLabel
}
