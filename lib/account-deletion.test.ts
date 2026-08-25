import { describe, expect, it } from "vitest";

import {
  deletionErrorMessage,
  deletionPreviewMessage,
  formatFolderCount,
  formatMemoryCount,
} from "./account-deletion";

describe("count formatting", () => {
  it("pluralizes ricordo/ricordi", () => {
    expect(formatMemoryCount(0)).toBe("0 ricordi");
    expect(formatMemoryCount(1)).toBe("1 ricordo");
    expect(formatMemoryCount(779)).toBe("779 ricordi");
  });

  it("pluralizes cartella/cartelle", () => {
    expect(formatFolderCount(1)).toBe("1 cartella");
    expect(formatFolderCount(4)).toBe("4 cartelle");
  });
});

describe("deletionPreviewMessage", () => {
  it("falls back to a count-free sentence when counts are unknown", () => {
    expect(deletionPreviewMessage(null)).toBe(
      "Tutti i tuoi ricordi, le cartelle e la cronologia dei ripassi verranno eliminati per sempre.",
    );
  });

  it("uses plural agreement for many memories in one folder", () => {
    expect(deletionPreviewMessage({ memories: 12, folders: 1 })).toBe(
      "12 ricordi in 1 cartella verranno eliminati per sempre.",
    );
  });

  it("uses singular agreement for one memory", () => {
    expect(deletionPreviewMessage({ memories: 1, folders: 1 })).toBe(
      "1 ricordo in 1 cartella verrà eliminato per sempre.",
    );
  });

  it("handles many folders", () => {
    expect(deletionPreviewMessage({ memories: 779, folders: 4 })).toBe(
      "779 ricordi in 4 cartelle verranno eliminati per sempre.",
    );
  });

  it("does not claim memories when there are none", () => {
    expect(deletionPreviewMessage({ memories: 0, folders: 1 })).toBe(
      "1 cartella e la cronologia dei ripassi verranno eliminate per sempre.",
    );
    expect(deletionPreviewMessage({ memories: 0, folders: 0 })).toBe(
      "Il tuo profilo e la cronologia dei ripassi verranno eliminati per sempre.",
    );
  });
});

describe("deletionErrorMessage", () => {
  it("maps the RPC's 42501 to a re-login hint", () => {
    expect(
      deletionErrorMessage({ code: "42501", message: "delete_own_account() requires an authenticated user" }),
    ).toBe("La sessione è scaduta. Accedi di nuovo e riprova.");
  });

  it("maps expired JWT errors to a re-login hint", () => {
    expect(deletionErrorMessage({ code: "PGRST301", message: "JWT expired" })).toBe(
      "La sessione è scaduta. Accedi di nuovo e riprova.",
    );
  });

  it("maps network failures", () => {
    expect(deletionErrorMessage(new TypeError("Network request failed"))).toBe(
      "Nessuna connessione. Controlla la rete e riprova.",
    );
  });

  it("never echoes the raw error text", () => {
    const msg = deletionErrorMessage(new Error('relation "public.secret_table" does not exist'));
    expect(msg).toBe("Eliminazione non riuscita. Riprova tra poco.");
    expect(msg).not.toContain("secret_table");
    expect(deletionErrorMessage(undefined)).toBe("Eliminazione non riuscita. Riprova tra poco.");
  });
});
