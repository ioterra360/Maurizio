import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, ScrollView, Text, TextInput, View } from "react-native";
import { Layers, Plus, Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { FolderTile } from "@/components/FolderTile";
import { MascotLoader } from "@/components/MascotLoader";
import { SectionLabel } from "@/components/SectionLabel";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { RetentionBar } from "@/components/RetentionBar";
import { StatBlock } from "@/components/StatBlock";
import { SettingsToggle } from "@/components/SettingsRow";
import { Tappable } from "@/components/Tappable";
import {
  countMemoriesInFolder,
  createSubfolder,
  deleteFolder,
  deleteSubfolder,
  fetchSubfolders,
  renameSubfolder,
  updateFolderName,
  updateFolderPaused,
} from "@/lib/api";
import { NamePromptModal } from "@/components/NamePromptModal";
import { useAuthStore } from "@/lib/auth-store";
import { SUBFOLDERS_MAX } from "@/lib/constants";
import type { Subfolder } from "@/lib/mappers";
import { useFolderDetail } from "@/lib/use-folders";
import { useUIStore } from "@/lib/ui-store";
import { reportError } from "@/lib/report-error";
import { safeBack } from "@/lib/safe-back";
import { relativeReviewed } from "@/lib/format";
import { FOLDER_KINDS, type FolderKind } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import { FONT, useColors } from "@/theme/tokens";

/**
 * Folder settings — reached from the cog in FolderTopBar. Lives in the ROOT
 * stack (like /add) rather than under (app): every file in that group
 * becomes a tab, and this screen must push OVER the folder detail tab so
 * back pops naturally onto it.
 */
export default function FolderSettingsScreen() {
  const colors = useColors();
  const { t, tp } = useT();
  const params = useLocalSearchParams<{ id: string }>();
  const idParam = params.id && params.id.length > 0 ? params.id : null;
  const { folder, items, loading, refetch } = useFolderDetail(idParam);
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);
  // Sottocartelle: elenco + modale nome (aggiungi/rinomina).
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [subModal, setSubModal] = useState<
    { mode: "add" } | { mode: "rename"; target: Subfolder } | null
  >(null);
  const [subSaving, setSubSaving] = useState(false);
  const settingsFolderId = folder?.id ?? null;
  const loadSubfolders = useCallback(async () => {
    if (!settingsFolderId) return;
    try {
      setSubfolders(await fetchSubfolders(settingsFolderId));
    } catch (err) {
      reportError("folder-settings/subfolders-load", err);
    }
  }, [settingsFolderId]);
  useEffect(() => {
    void loadSubfolders();
  }, [loadSubfolders]);

  const confirmDeleteSubfolder = (sub: Subfolder) => {
    Alert.alert(
      t("subfolders.deleteTitle", { name: sub.name }),
      t("subfolders.deleteBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => {
            deleteSubfolder(sub.id)
              .then(() => {
                showToast(t("subfolders.deleted"));
                void loadSubfolders();
              })
              .catch((err) => {
                reportError("folder-settings/subfolder-delete", err);
                showToast(t("subfolders.failed"));
              });
          },
        },
      ],
    );
  };
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ultimo ripasso della cartella: il timestamp più recente tra i suoi item.
  const lastReviewLabel = useMemo(() => {
    const ts = items
      .map((i) => i.lastReviewedAt)
      .filter((v): v is string => !!v)
      .sort()
      .at(-1);
    return ts ? relativeReviewed(ts) : t("common.never");
  }, [items, t]);

  // Seed the input once per folder row — keyed on id so a background
  // refetch can't clobber what the user is typing.
  const folderId = folder?.id ?? null;
  const folderName = folder?.name ?? "";
  useEffect(() => {
    if (folderId) setName(folderName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const trimmed = name.trim();
  const canSave = !!folder && !saving && trimmed.length > 0 && trimmed !== folder.name;

  const openDeleteConfirm = async () => {
    if (!folder) return;
    setMemoryCount(null);
    setConfirmDelete(true);
    const n = await countMemoriesInFolder(folder.id).catch(() => null);
    setMemoryCount(n);
  };

  const handleDelete = async () => {
    if (!folder) return;
    setDeleting(true);
    try {
      await deleteFolder(folder.id);
      showToast(t("folderSettings.toastDeleted", { name: folder.name }));
      router.replace("/(app)/knowledge");
    } catch (err) {
      reportError("folder-settings/delete", err);
      showToast(t("folderSettings.toastDeleteFailed"));
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSave = async () => {
    if (!folder || !canSave) return;
    setSaving(true);
    try {
      await updateFolderName(folder.id, trimmed);
      showToast(t("folderSettings.toastRenamed"));
      // Folder detail refetches on focus, so the new name shows on return.
      safeBack("/(app)/knowledge");
    } catch (err) {
      reportError("folder-settings/rename", err);
      showToast(t("folderSettings.toastSaveFailed"));
      setSaving(false);
    }
  };

  if (!idParam) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar />
        <View style={{ padding: 24 }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 18, color: colors.navy }}>
            {t("folderSettings.notFound")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !folder) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar title={t("folderSettings.title")} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("common.oneMoment")} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title={t("folderSettings.title")} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Statistiche della cartella — stessi rollup del dettaglio */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
          <SectionLabel>{t("folderSettings.statsSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 18,
              paddingTop: 18,
              paddingBottom: 16,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <RetentionBar
              active={folder?.active ?? 0}
              fading={folder?.fading ?? 0}
              archived={folder?.archived ?? 0}
              width="100%"
              height={10}
            />
            <View className="mt-4 flex-row" style={{ justifyContent: "space-between" }}>
              <StatBlock
                dot={colors.active}
                label={t("folderSettings.stateStable")}
                pct={folder?.active ?? 0}
                count={Math.round(((folder?.count ?? 0) * (folder?.active ?? 0)) / 100)}
              />
              <StatBlock
                dot={colors.fading}
                label={t("folderSettings.stateFading")}
                pct={folder?.fading ?? 0}
                count={Math.round(((folder?.count ?? 0) * (folder?.fading ?? 0)) / 100)}
              />
              <StatBlock
                dot={colors.archived}
                label={t("folderSettings.stateArchived")}
                pct={folder?.archived ?? 0}
                count={Math.round(((folder?.count ?? 0) * (folder?.archived ?? 0)) / 100)}
              />
            </View>
            <Text
              style={{
                marginTop: 14,
                fontFamily: FONT.regular,
                fontSize: 12.5,
                color: colors.midGrey,
                fontVariant: ["tabular-nums"],
              }}
            >
              {tp("folderSettings.statsSummary", folder?.count ?? 0, {
                addedThisWeek: folder?.addedThisWeek ?? 0,
                lastReview: lastReviewLabel,
              })}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("folderSettings.nameSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="flex-row items-center rounded-card bg-surface"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              gap: 12,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <FolderTile emoji={folder?.emoji} size={36} />
            <TextInput
              value={name}
              onChangeText={setName}
              editable={!loading && !saving}
              placeholder={t("folderSettings.namePlaceholder")}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t("folderSettings.namePlaceholder")}
              style={{
                flex: 1,
                fontFamily: FONT.semibold,
                fontSize: 16.5,
                color: colors.navy,
                letterSpacing: -0.15,
                padding: 0,
              }}
            />
          </View>
        </View>

        {/* Ritmo — cartella dormiente */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("folderSettings.rhythmSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <SettingsToggle
            key={folder ? `paused-${folder.paused}` : "paused"}
            label={t("folderSettings.pauseLabel")}
            hint={t("folderSettings.pauseHint")}
            defaultOn={folder?.paused ?? false}
            onChange={(v) => {
              if (!folder) return;
              updateFolderPaused(folder.id, v)
                .then(() => {
                  showToast(
                    v ? t("folderSettings.toastPaused") : t("folderSettings.toastResumed"),
                  );
                  refetch();
                })
                .catch((err) => {
                  reportError("folder-settings/pause", err);
                  showToast(t("folderSettings.toastPauseFailed"));
                });
            }}
          />
        </View>

        {/* Sottocartelle */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("subfolders.section")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {subfolders.map((sub) => (
            <Tappable
              key={sub.id}
              onPress={() => setSubModal({ mode: "rename", target: sub })}
              accessibilityRole="button"
              accessibilityLabel={t("subfolders.rowA11y", { name: sub.name })}
              pressedOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
                paddingLeft: 14,
                paddingRight: 8,
                paddingVertical: 12,
              }}
            >
              <Layers size={17} color={colors.navy} strokeWidth={1.9} />
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
                  {sub.name}
                </Text>
                <Text style={{ fontFamily: FONT.regular, fontSize: 12, color: colors.midGrey, marginTop: 2 }}>
                  {t("subfolders.rowHint")}
                </Text>
              </View>
              <Tappable
                onPress={() => confirmDeleteSubfolder(sub)}
                accessibilityRole="button"
                accessibilityLabel={t("subfolders.deleteA11y", { name: sub.name })}
                pressedOpacity={0.6}
                style={{ padding: 10 }}
              >
                <Trash2 size={17} color={colors.danger} strokeWidth={1.9} />
              </Tappable>
            </Tappable>
          ))}
          {subfolders.length < SUBFOLDERS_MAX ? (
            <Tappable
              onPress={() => setSubModal({ mode: "add" })}
              accessibilityRole="button"
              accessibilityLabel={t("subfolders.add")}
              pressedOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
                borderRadius: 14,
                borderWidth: 1.2,
                borderColor: colors.hairlineStrong,
                borderStyle: "dashed",
                backgroundColor: colors.warmWhite,
              }}
            >
              <Plus size={15} color={colors.navy} strokeWidth={2.1} />
              <Text style={{ fontFamily: FONT.semibold, fontSize: 13.5, color: colors.navy }}>
                {t("subfolders.add")}
              </Text>
            </Tappable>
          ) : (
            <Text style={{ paddingHorizontal: 8, fontFamily: FONT.regular, fontSize: 12, color: colors.midGrey }}>
              {t("subfolders.limit")}
            </Text>
          )}
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>{t("folderSettings.orderSection")}</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <View
            className="rounded-card bg-surface"
            style={{
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.hairline,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 13.5,
                color: colors.midGrey,
                lineHeight: 20,
              }}
            >
              {t("folderSettings.orderHint")}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <PrimaryButton
            label={saving ? t("folderSettings.saving") : t("common.save")}
            onPress={handleSave}
            disabled={!canSave}
          />
        </View>

        {/* Zona pericolosa */}
        <View style={{ alignItems: "center", marginTop: 30 }}>
          <Tappable
            onPress={openDeleteConfirm}
            accessibilityRole="button"
            accessibilityLabel={t("folderSettings.deleteFolder")}
            pressedOpacity={0.6}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.danger }}>
              {t("folderSettings.deleteFolder")}
            </Text>
          </Tappable>
        </View>
      </ScrollView>

      <NamePromptModal
        visible={subModal !== null}
        title={subModal?.mode === "rename" ? t("subfolders.renameTitle") : t("subfolders.addTitle")}
        initialValue={subModal?.mode === "rename" ? subModal.target.name : ""}
        placeholder={t("subfolders.namePlaceholder")}
        saving={subSaving}
        onClose={() => {
          if (!subSaving) setSubModal(null);
        }}
        onSave={(name) => {
          if (!subModal || subSaving || !user || !settingsFolderId) return;
          setSubSaving(true);
          const op =
            subModal.mode === "rename"
              ? renameSubfolder(subModal.target.name === name ? subModal.target.id : subModal.target.id, name)
              : createSubfolder(user.id, settingsFolderId, name).then(() => undefined);
          op
            .then(() => {
              showToast(
                subModal.mode === "rename"
                  ? t("subfolders.renamed")
                  : t("subfolders.created", { name }),
              );
              setSubModal(null);
              void loadSubfolders();
            })
            .catch((err) => {
              reportError("folder-settings/subfolder-save", err);
              const code = (err as { code?: string })?.code ?? "";
              const msg = err instanceof Error ? err.message : String(err);
              showToast(
                code === "23505" || msg.includes("duplicate")
                  ? t("subfolders.duplicate")
                  : msg.includes("limit")
                    ? t("subfolders.limit")
                    : t("subfolders.failed"),
              );
            })
            .finally(() => setSubSaving(false));
        }}
      />

      {/* Conferma eliminazione — mostra quanti ricordi cascano col delete */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setConfirmDelete(false);
        }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(26,44,79,0.45)",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <View
            style={{
              alignSelf: "stretch",
              backgroundColor: colors.warmWhite,
              borderRadius: 18,
              padding: 22,
              gap: 12,
            }}
          >
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 19,
                color: colors.navy,
                letterSpacing: -0.3,
              }}
            >
              {t("folderSettings.deleteConfirmTitle", {
                name: folder?.name ?? t("folderSettings.thisFolderFallback"),
              })}
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 14.5,
                color: colors.midGrey,
                lineHeight: 21,
              }}
            >
              {memoryCount === null
                ? t("folderSettings.deleteConfirmBodyUnknown")
                : tp("folderSettings.deleteConfirmBody", memoryCount)}
            </Text>
            <View style={{ gap: 10, marginTop: 6 }}>
              <PrimaryButton
                label={deleting ? t("folderSettings.deleting") : t("folderSettings.deleteFolder")}
                color={colors.danger}
                onPress={handleDelete}
                disabled={deleting}
              />
              <GhostButton
                label={t("common.cancel")}
                onPress={() => setConfirmDelete(false)}
                disabled={deleting}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
