/**
 * Pure helpers for the Cestino (trash) feature. Deleted folders/memories get
 * a `deleted_at` timestamp and are purged server-side (pg_cron, migration
 * 20260830) once they are older than TRASH_RETENTION_HOURS. The UI shows a
 * countdown from the same constant so copy and purge can never drift apart.
 */

export const TRASH_RETENTION_HOURS = 24;

/** Grace window for account deletion — mirror of the SQL purge interval. */
export const ACCOUNT_DELETION_GRACE_HOURS = 72;

/**
 * Whole hours until the item is purged, ceiled so the label never promises
 * less time than the user actually has ("1 ora" while 10 minutes remain,
 * never "0 ore" while the item is still restorable). 0 = purge due.
 * An unparsable timestamp counts as expired — the row is about to vanish.
 */
export function trashHoursLeft(
  deletedAt: string,
  now: Date = new Date(),
  retentionHours: number = TRASH_RETENTION_HOURS,
): number {
  const t = Date.parse(deletedAt);
  if (Number.isNaN(t)) return 0;
  const msLeft = t + retentionHours * 3_600_000 - now.getTime();
  return Math.max(0, Math.ceil(msLeft / 3_600_000));
}
