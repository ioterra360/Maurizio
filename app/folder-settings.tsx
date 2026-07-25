import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Text, TextInput, View } from "react-native";
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
  deleteFolder,
  updateFolderName,
  updateFolderPaused,
} from "@/lib/api";
import { useFolderDetail } from "@/lib/use-folders";
import { useUIStore } from "@/lib/ui-store";
import { safeBack } from "@/lib/safe-back";
import { relativeReviewed } from "@/lib/format";
import { FOLDER_KINDS, type FolderKind } from "@/lib/constants";
import { FONT, colors } from "@/theme/tokens";

/**
 * Folder settings — reached from the cog in FolderTopBar. Lives in the ROOT
 * stack (like /add) rather than under (app): every file in that group
 * becomes a tab, and this screen must push OVER the folder detail tab so
 * back pops naturally onto it.
 */
export default function FolderSettingsScreen() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = (FOLDER_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as FolderKind)
    : null;
  const { folder, items, loading, refetch } = useFolderDetail(kind);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [memoryCount, setMemoryCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Ultimo ripasso della cartella: il timestamp più recente tra i suoi item.
  const lastReviewLabel = useMemo(() => {
    const ts = items
      .map((i) => i.lastReviewedAt)
      .filter((t): t is string => !!t)
      .sort()
      .at(-1);
    return ts ? relativeReviewed(ts) : "mai";
  }, [items]);

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
      showToast(`Cartella ${folder.name} eliminata`);
      router.replace("/(app)/knowledge");
    } catch (err) {
      if (__DEV__) console.warn("[Memika] folder delete failed", err);
      showToast("Eliminazione non riuscita. Riprova.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleSave = async () => {
    if (!folder || !canSave) return;
    setSaving(true);
    try {
      await updateFolderName(folder.id, trimmed);
      showToast("Nome della cartella aggiornato");
      // Folder detail refetches on focus, so the new name shows on return.
      safeBack("/(app)/knowledge");
    } catch (err) {
      if (__DEV__) console.warn("[Memika] folder rename failed", err);
      showToast("Salvataggio non riuscito. Riprova.");
      setSaving(false);
    }
  };

  if (!kind) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar />
        <View style={{ padding: 24 }}>
          <Text style={{ fontFamily: FONT.semibold, fontSize: 18, color: colors.navy }}>
            Cartella non trovata.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && !folder) {
    return (
      <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
        <TopBar title="Impostazioni cartella" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label="Un attimo…" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar title="Impostazioni cartella" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Statistiche della cartella — stessi rollup del dettaglio */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
          <SectionLabel>Statistiche</SectionLabel>
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
                label="Stabili"
                pct={folder?.active ?? 0}
                count={Math.round(((folder?.count ?? 0) * (folder?.active ?? 0)) / 100)}
              />
              <StatBlock
                dot={colors.fading}
                label="In dissolvenza"
                pct={folder?.fading ?? 0}
                count={Math.round(((folder?.count ?? 0) * (folder?.fading ?? 0)) / 100)}
              />
              <StatBlock
                dot={colors.archived}
                label="Archiviati"
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
              {folder?.count ?? 0} ricordi · {folder?.addedThisWeek ?? 0} aggiunti questa
              settimana · ultimo ripasso {lastReviewLabel}
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Nome</SectionLabel>
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
            <FolderTile kind={kind} size={36} />
            <TextInput
              value={name}
              onChangeText={setName}
              editable={!loading && !saving}
              placeholder="Nome della cartella"
              placeholderTextColor={colors.placeholder}
              accessibilityLabel="Nome della cartella"
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
          <SectionLabel>Ritmo</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16 }}>
          <SettingsToggle
            key={folder ? `paused-${folder.paused}` : "paused"}
            label="Metti in pausa"
            hint="La cartella esce dai ripassi finché non la riattivi. Nessun ricordo va perso."
            defaultOn={folder?.paused ?? false}
            onChange={(v) => {
              if (!folder) return;
              updateFolderPaused(folder.id, v)
                .then(() => {
                  showToast(v ? "Cartella in pausa" : "Cartella riattivata");
                  refetch();
                })
                .catch((err) => {
                  if (__DEV__) console.warn("[Memika] folder pause failed", err);
                  showToast("Operazione non riuscita. Riprova.");
                });
            }}
          />
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Ordine</SectionLabel>
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
              La posizione nella lista si cambia da Cartelle: tieni premuta una
              cartella e trascinala dove vuoi.
            </Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 28 }}>
          <PrimaryButton
            label={saving ? "Salvataggio…" : "Salva"}
            onPress={handleSave}
            disabled={!canSave}
          />
        </View>

        {/* Zona pericolosa */}
        <View style={{ alignItems: "center", marginTop: 30 }}>
          <Tappable
            onPress={openDeleteConfirm}
            accessibilityRole="button"
            accessibilityLabel="Elimina cartella"
            pressedOpacity={0.6}
            style={{ paddingVertical: 8, paddingHorizontal: 12 }}
          >
            <Text style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.danger }}>
              Elimina cartella
            </Text>
          </Tappable>
        </View>
      </ScrollView>

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
              Eliminare {folder?.name ?? "questa cartella"}?
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
                ? "Tutti i ricordi della cartella verranno eliminati per sempre."
                : memoryCount === 1
                  ? "1 ricordo verrà eliminato per sempre."
                  : `${memoryCount} ricordi verranno eliminati per sempre.`}{" "}
              Non si può annullare.
            </Text>
            <View style={{ gap: 10, marginTop: 6 }}>
              <PrimaryButton
                label={deleting ? "Elimino…" : "Elimina cartella"}
                color={colors.danger}
                onPress={handleDelete}
                disabled={deleting}
              />
              <GhostButton
                label="Annulla"
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
