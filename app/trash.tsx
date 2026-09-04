import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock3, RotateCcw, Trash2 } from "lucide-react-native";

import { FolderTile } from "@/components/FolderTile";
import { Mascot } from "@/components/Mascot";
import { MascotLoader } from "@/components/MascotLoader";
import { PlanLimitDialog } from "@/components/PlanLimitDialog";
import { SectionLabel } from "@/components/SectionLabel";
import { Tappable } from "@/components/Tappable";
import { TopBar } from "@/components/TopBar";
import {
  fetchMemoriesForFolder,
  fetchTrash,
  restoreFolder,
  restoreMemory,
  type TrashContent,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";
import { planLimitFromCode, type PlanLimitKind } from "@/lib/plan";
import { errorCode, reportError } from "@/lib/report-error";
import { trashHoursLeft } from "@/lib/trash";
import { usePlan } from "@/lib/use-plan";
import { useUIStore } from "@/lib/ui-store";
import type { FolderKind } from "@/lib/constants";
import { FOLDER_KINDS } from "@/lib/constants";
import { FONT, radii, useColors } from "@/theme/tokens";
import { scheduleFirstReview } from "@/lib/notifications";

/**
 * Cestino — cartelle e ricordi eliminati nelle ultime 24 ore (Maurizio,
 * 2026-08-30). Raggiungibile dalla riga in fondo a Cartelle e da
 * Impostazioni. Ogni voce mostra il tempo rimasto prima della purga
 * server-side (pg_cron) e un tasto Ripristina. Vive nello stack ROOT come
 * /add e /folder-settings, così il back torna alla schermata di provenienza.
 */
export default function TrashScreen() {
  const colors = useColors();
  const { t, tp } = useT();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  const plan = usePlan();

  const [trash, setTrash] = useState<TrashContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Id (cartella o ricordo) del ripristino in corso — disabilita quel tasto.
  const [restoring, setRestoring] = useState<string | null>(null);
  // Il ripristino di una cartella e' l'unica UPDATE che passa da un tetto di
  // piano (folders_enforce_plan_limit_on_restore, P0005): senza questo ramo
  // l'utente si vedrebbe "Riprova" sull'unica azione che fallira' sempre.
  const [planBlock, setPlanBlock] = useState<PlanLimitKind | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(false);
    try {
      setTrash(await fetchTrash(user.id));
    } catch (e) {
      reportError("trash/fetch", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRestoreFolder = async (id: string, name: string) => {
    if (restoring) return;
    setRestoring(id);
    try {
      await restoreFolder(id);
      // I ricordi tornati vivi con nextReviewAt ancora nel futuro riavranno
      // il loro avviso; gli altri sono già in coda e non serve nulla.
      fetchMemoriesForFolder(id)
        .then(async (items) => {
          // Sequenziale, non `void`: il tetto di lib/notifications.ts conta la
          // coda prima di ogni richiesta, e N chiamate concorrenti leggerebbero
          // tutte lo stesso conteggio pre-raffica scavalcandolo.
          for (const m of items) await scheduleFirstReview(m);
        })
        .catch((e) => reportError("trash/reschedule-folder", e));
      showToast(t("trash.restoredFolder", { name }));
      await load();
    } catch (e) {
      const limit = planLimitFromCode(errorCode(e));
      if (limit) {
        setPlanBlock(limit);
        return;
      }
      reportError("trash/restore-folder", e);
      showToast(t("trash.restoreFailed"));
    } finally {
      setRestoring(null);
    }
  };

  const onRestoreMemory = async (id: string) => {
    if (restoring) return;
    setRestoring(id);
    try {
      await restoreMemory(id);
      const restored = trash?.memories.find((m) => m.id === id);
      if (restored) void scheduleFirstReview(restored);
      showToast(t("trash.restoredMemory"));
      await load();
    } catch (e) {
      // restoreMemory ripristina PRIMA la cartella madre (lib/api.ts): il
      // rifiuto che arriva qui e' quello del tetto cartelle, non dei ricordi.
      const limit = planLimitFromCode(errorCode(e));
      if (limit) {
        setPlanBlock(limit);
        return;
      }
      reportError("trash/restore-memory", e);
      showToast(t("trash.restoreFailed"));
    } finally {
      setRestoring(null);
    }
  };

  const hoursLabel = (deletedAt: string | null) => {
    const hours = deletedAt ? trashHoursLeft(deletedAt) : 0;
    return hours > 0 ? tp("trash.hoursLeft", hours) : t("trash.purgeSoon");
  };

  const isEmpty =
    !loading && !error && trash !== null && trash.folders.length === 0 && trash.memories.length === 0;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("trash.title")} />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("trash.loading")} />
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy, textAlign: "center" }}>
            {t("trash.loadFailed")}
          </Text>
          <Tappable
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel={t("common.retry")}
            style={{
              paddingHorizontal: 18,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1.5,
              borderColor: colors.navy,
              backgroundColor: colors.warmWhite,
            }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14, color: colors.navy }}>
              {t("common.retry")}
            </Text>
          </Tappable>
        </View>
      ) : isEmpty ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <Mascot variant="checklist" size={104} withShadow={false} />
          <Text style={{ fontFamily: FONT.semibold, fontSize: 15.5, color: colors.navy, textAlign: "center" }}>
            {t("trash.empty")}
          </Text>
          <Text
            style={{
              fontFamily: FONT.regular,
              fontSize: 13.5,
              lineHeight: 20,
              color: colors.midGrey,
              textAlign: "center",
            }}
          >
            {t("trash.emptyBody")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avviso 24 ore — sempre visibile sopra le liste. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: colors.dangerSoft,
              borderRadius: radii.card,
              borderWidth: 1,
              borderColor: colors.danger,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <Trash2 size={16} color={colors.danger} strokeWidth={2} />
            <Text
              style={{
                flex: 1,
                fontFamily: FONT.medium,
                fontSize: 13,
                lineHeight: 19,
                color: colors.danger,
              }}
            >
              {t("trash.banner")}
            </Text>
          </View>

          {trash && trash.folders.length > 0 ? (
            <>
              <View style={{ paddingHorizontal: 8, paddingTop: 20, paddingBottom: 8 }}>
                <SectionLabel>{t("trash.foldersSection")}</SectionLabel>
              </View>
              <View style={{ gap: 8 }}>
                {trash.folders.map((f) => (
                  <TrashRow
                    key={f.id}
                    tile={
                      <FolderTile
                        emoji={f.emoji}
                        kind={
                          ((FOLDER_KINDS as readonly string[]).includes(f.kind)
                            ? f.kind
                            : "custom") as FolderKind
                        }
                        size={36}
                      />
                    }
                    title={f.name}
                    subtitle={tp("accountDeletion.memoryCount", f.memoryCount)}
                    hoursLabel={hoursLabel(f.deletedAt)}
                    restoreLabel={t("trash.restore")}
                    restoreA11y={t("trash.restoreA11yFolder", { name: f.name })}
                    busy={restoring === f.id}
                    disabled={restoring !== null}
                    onRestore={() => void onRestoreFolder(f.id, f.name)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {trash && trash.memories.length > 0 ? (
            <>
              <View style={{ paddingHorizontal: 8, paddingTop: 20, paddingBottom: 8 }}>
                <SectionLabel>{t("trash.memoriesSection")}</SectionLabel>
              </View>
              <View style={{ gap: 8 }}>
                {trash.memories.map((m) => (
                  <TrashRow
                    key={m.id}
                    title={m.term}
                    subtitle={m.folderName ?? ""}
                    hoursLabel={hoursLabel(m.deletedAt)}
                    restoreLabel={t("trash.restore")}
                    restoreA11y={t("trash.restoreA11yMemory", { term: m.term })}
                    busy={restoring === m.id}
                    disabled={restoring !== null}
                    onRestore={() => void onRestoreMemory(m.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
      <PlanLimitDialog
        limit={planBlock}
        plan={plan}
        context="restore"
        onClose={() => setPlanBlock(null)}
      />
    </SafeAreaView>
  );
}

function TrashRow({
  tile,
  title,
  subtitle,
  hoursLabel,
  restoreLabel,
  restoreA11y,
  busy,
  disabled,
  onRestore,
}: {
  tile?: React.ReactNode;
  title: string;
  subtitle: string;
  hoursLabel: string;
  restoreLabel: string;
  restoreA11y: string;
  busy: boolean;
  disabled: boolean;
  onRestore: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.hairline,
        paddingLeft: 14,
        paddingRight: 10,
        paddingVertical: 12,
      }}
    >
      {tile}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: FONT.semibold,
            fontSize: 15,
            color: colors.navy,
            letterSpacing: -0.15,
          }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: FONT.regular, fontSize: 12.5, color: colors.midGrey, marginTop: 2 }}
          >
            {subtitle}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
          <Clock3 size={12} color={colors.danger} strokeWidth={2} />
          <Text
            style={{
              fontFamily: FONT.medium,
              fontSize: 11.5,
              color: colors.danger,
              fontVariant: ["tabular-nums"],
            }}
          >
            {hoursLabel}
          </Text>
        </View>
      </View>
      <Tappable
        onPress={onRestore}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={restoreA11y}
        pressedOpacity={0.7}
        containerStyle={{ opacity: busy ? 0.5 : disabled ? 0.7 : 1 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 9,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: colors.navy,
          backgroundColor: colors.warmWhite,
        }}
      >
        <RotateCcw size={14} color={colors.navy} strokeWidth={2.1} />
        <Text style={{ fontFamily: FONT.semibold, fontSize: 13.5, color: colors.navy }}>
          {restoreLabel}
        </Text>
      </Tappable>
    </View>
  );
}
