import { router } from "expo-router";

import { MascotDialog } from "@/components/MascotDialog";
import { useT } from "@/lib/i18n";
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
 * contesto — a un utente Pro non si dice "passa a Pro".
 *
 * Il dialogo si chiude PRIMA della navigazione: un Modal ancora montato
 * mentre il router spinge una rotta lascia il backdrop sopra la schermata
 * nuova (stessa precauzione di settings.tsx col picker del limite).
 */
export function PlanLimitDialog({ limit, plan, onClose, context = "add" }: Props) {
  const { t } = useT();
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
        : { title: t("planLimit.foldersTitlePro"), body: t("planLimit.foldersBodyPro") };
    }
    return plan === "free"
      ? { title: t("planLimit.sectionsTitleFree"), body: t("planLimit.sectionsBodyFree") }
      : { title: t("planLimit.sectionsTitlePro"), body: t("planLimit.sectionsBodyPro") };
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
        router.push("/paywall" as never);
      }}
      onCancel={onClose}
    />
  );
}
