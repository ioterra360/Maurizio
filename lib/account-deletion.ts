/**
 * Pure helpers for the "Elimina account" sheet in Settings. Kept out of the
 * screen so the copy (singular/plural, error mapping) is unit-tested and the
 * RPC call in lib/api.ts stays a one-liner. Every string resolves through
 * lib/i18n at call time so the Settings language switch applies at once.
 */
import { t, tp } from "@/lib/i18n";

export type DeletionPreview = { memories: number; folders: number };

/** "1 ricordo" / "N ricordi" — plural of "memory" in the current language. */
export function formatMemoryCount(n: number): string {
  return tp("accountDeletion.memoryCount", n);
}

/** "1 cartella" / "N cartelle". */
export function formatFolderCount(n: number): string {
  return tp("accountDeletion.folderCount", n);
}

/**
 * Body copy of the confirmation sheet. `null` = counts not loaded (or the
 * count query failed): fall back to an honest, count-free sentence rather
 * than a fake number.
 */
export function deletionPreviewMessage(preview: DeletionPreview | null): string {
  if (!preview) {
    return t("accountDeletion.previewUnknown");
  }
  if (preview.memories === 0 && preview.folders === 0) {
    return t("accountDeletion.previewEmpty");
  }
  if (preview.memories === 0) {
    return tp("accountDeletion.previewFoldersOnly", preview.folders);
  }
  return tp("accountDeletion.previewFull", preview.memories, {
    folders: formatFolderCount(preview.folders),
  });
}

/**
 * Localised, user-safe message for a failed deletion. Never echoes the raw
 * error: Postgres/PostgREST strings are English and may leak schema names.
 *
 * 42501 is what delete_own_account() raises when there is no authenticated
 * caller (JWT expired or already revoked) — the fix is a fresh login.
 */
export function deletionErrorMessage(err: unknown): string {
  const code = readCode(err);
  const msg = readMessage(err).toLowerCase();
  if (code === "42501" || code === "PGRST301" || msg.includes("jwt") || msg.includes("not authenticated")) {
    return t("accountDeletion.sessionExpired");
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("timeout")) {
    return t("accountDeletion.noConnection");
  }
  return t("accountDeletion.deleteFailed");
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
