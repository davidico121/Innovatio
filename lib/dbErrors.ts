/**
 * True when a query failed because a table or column that the newest database migration adds does not
 * exist yet. Normally the migration runs before every deploy, so this should never happen. It is a safety
 * net so that a missed migration cannot break sign-out, the summary email or reminders.
 */
export function isMissingSchema(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703"; // undefined_table, undefined_column
}
