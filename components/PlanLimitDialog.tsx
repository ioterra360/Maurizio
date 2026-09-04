import { useState } from "react";
import { router } from "expo-router";

import { MascotDialog } from "@/components/MascotDialog";
import { useT } from "@/lib/i18n";
import { deferUntilModalDismissed } from "@/lib/modal-nav";
import type { Plan, PlanLimitKind } from "@/lib/plan";

type Props = {
  /** null = chiuso. */
  limit: PlanLimitKind | null;
  plan: Plan;
  onClose: () => void;
  /**
   * Da dove arriva il rifiuto. `"add"` (default) = stavi creando qualcosa.
   * `"restore"` = stavi tirando fuori dal cestino una cartella e le vive
   * sono gia' al tetto (trigger folders_enforce_plan_limit_on_restore,
   * stesso P0005): li' "il piano ne tiene una" non basta, perche' il rimedio
   * non e' solo pagare — basta liberare uno slot vivo.
   */
  context?: "add" | "restore";
};

/**
 * La mascotte spiega quale limite hai incontrato e propone l'upgrade.
 *
 * Un solo componente per cinque schermate (Add, Nuova cartella, Sezioni in
 * due punti, Cestino): la copy cambia col limite, col piano E con il
 * contesto — a un utente Plus non si dice "passa a Plus".
 *
 * Il dialogo si chiude PRIMA della navigazione: un Modal ancora montato
 * mentre il router spinge una rotta lascia il backdrop sopra la schermata
 * nuova (stessa precauzione di settings.tsx col picker del limite).
 *
 * E su iOS non basta chiuderlo: bisogna ASPETTARE che sia chiuso. `/paywall`
 * e' `presentation: "modal"` (app/_layout.tsx) e questo dialogo e' un
 * `Modal` trasparente, cioe' un view controller gia' presentato sulla
 * schermata — spesso a sua volta un modale, /add. Chiudere e spingere nello
 * stesso tick significa chiedere a UIKit una seconda presentazione su un
 * controller occupato: viene rifiutata in silenzio, il foglio scivola via e
 * il paywall non compare, mentre lo stato del router dice il contrario.
 * Stessa regola, stesso rimedio del picker delle foto in app/add.tsx
 * (`requestPick`): `lib/modal-nav.ts`.
 */
export function PlanLimitDialog({ limit, plan, onClose, context = "add" }: Props) {
  const { t } = useT();
  // L'intenzione sopravvive alla chiusura del Modal e viene eseguita da
  // onDismiss. Solo su iOS: su Android onDismiss non arriva mai.
  const [pendingPaywall, setPendingPaywall] = useState(false);
  const copy = (): { title: string; body: string } => {
    if (limit === "folders" && context === "restore") {
      return {
        title: t("planLimit.foldersRestoreTitle"),
        body: t("planLimit.foldersRestoreBody"),
      };
    }
    if (limit === "memories") {
      return { title: t("planLimit.memoriesTitle"), body: t("planLimit.memoriesBody") };
    }
    if (limit === "folders") {
      return plan === "free"
        ? { title: t("planLimit.foldersTitleFree"), body: t("planLimit.foldersBodyFree") }
        : { title: t("planLimit.foldersTitlePlus"), body: t("planLimit.foldersBodyPlus") };
    }
    return plan === "free"
      ? { title: t("planLimit.sectionsTitleFree"), body: t("planLimit.sectionsBodyFree") }
      : { title: t("planLimit.sectionsTitlePlus"), body: t("planLimit.sectionsBodyPlus") };
  };
  const { title, body } = limit ? copy() : { title: "", body: "" };
  return (
    <MascotDialog
      visible={limit !== null}
      title={title}
      body={body}
      confirmLabel={t("planLimit.seePlans")}
      cancelLabel={t("planLimit.notNow")}
      onConfirm={() => {
        onClose();
        if (deferUntilModalDismissed()) setPendingPaywall(true);
        else router.push("/paywall" as never);
      }}
      onCancel={onClose}
      onDismissed={() => {
        // onDismiss scatta a OGNI chiusura, anche su "Non ora" e sul
        // backdrop: naviga solo se e' stato il bottone di conferma.
        if (!pendingPaywall) return;
        setPendingPaywall(false);
        router.push("/paywall" as never);
      }}
    />
  );
}
