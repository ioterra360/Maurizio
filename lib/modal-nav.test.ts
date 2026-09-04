/**
 * La regola "aspetta la chiusura del Modal prima di presentare" vive in un
 * posto solo perche' e' gia' stata dimenticata una volta: PhotoSheet la
 * applicava (app/add.tsx, `requestPick`) e il paywall no, quindi su iPhone
 * "Scopri Premium" chiudeva il dialogo e non apriva niente.
 */
import { describe, expect, it } from "vitest";

import { deferUntilModalDismissed } from "./modal-nav";

describe("deferUntilModalDismissed", () => {
  it("su iOS si aspetta: il Modal e' un view controller presentato", () => {
    expect(deferUntilModalDismissed("ios")).toBe(true);
  });

  it("su Android si naviga subito: il Modal e' un Dialog e onDismiss non arriva mai", () => {
    expect(deferUntilModalDismissed("android")).toBe(false);
  });

  it("qualsiasi altra piattaforma naviga subito", () => {
    expect(deferUntilModalDismissed("web")).toBe(false);
    expect(deferUntilModalDismissed("windows")).toBe(false);
  });

  it("senza argomento legge Platform.OS (nei test lo stub dice android)", () => {
    expect(deferUntilModalDismissed()).toBe(false);
  });
});
