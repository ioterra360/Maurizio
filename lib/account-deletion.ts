/**
 * Pure helpers for the "Elimina account" sheet in Settings. Kept out of the
 * screen so the Italian copy (singular/plural, error mapping) is unit-tested
 * and the RPC call in lib/api.ts stays a one-liner.
 */

export type DeletionPreview = { memories: number; folders: number };

/** "1 ricordo" / "N ricordi" — Italian plural of "ricordo". */
export function formatMemoryCount(n: number): string {
  return n === 1 ? "1 ricordo" : `${n} ricordi`;
}

/** "1 cartella" / "N cartelle". */
export function formatFolderCount(n: number): string {
  return n === 1 ? "1 cartella" : `${n} cartelle`;
}

/**
 * Body copy of the confirmation sheet. `null` = counts not loaded (or the
 * count query failed): fall back to an honest, count-free sentence rather
 * than a fake number.
 */
export function deletionPreviewMessage(preview: DeletionPreview | null): string {
  if (!preview) {
    return "Tutti i tuoi ricordi, le cartelle e la cronologia dei ripassi verranno eliminati per sempre.";
  }
  if (preview.memories === 0 && preview.folders === 0) {
    return "Il tuo profilo e la cronologia dei ripassi verranno eliminati per sempre.";
  }
  if (preview.memories === 0) {
    return `${capitalize(formatFolderCount(preview.folders))} e la cronologia dei ripassi verranno eliminate per sempre.`;
  }
  const verb = preview.memories === 1 ? "verrà eliminato" : "verranno eliminati";
  return `${capitalize(formatMemoryCount(preview.memories))} in ${formatFolderCount(preview.folders)} ${verb} per sempre.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Italian, user-safe message for a failed deletion. Never echoes the raw
 * error: Postgres/PostgREST strings are English and may leak schema names.
 *
 * 42501 is what delete_own_account() raises when there is no authenticated
 * caller (JWT expired or already revoked) — the fix is a fresh login.
 */
export function deletionErrorMessage(err: unknown): string {
  const code = readCode(err);
  const msg = readMessage(err).toLowerCase();
  if (code === "42501" || code === "PGRST301" || msg.includes("jwt") || msg.includes("not authenticated")) {
    return "La sessione è scaduta. Accedi di nuovo e riprova.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
    return "Nessuna connessione. Controlla la rete e riprova.";
  }
  return "Eliminazione non riuscita. Riprova tra poco.";
}

function readCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function readMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}
