import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { FolderTile } from "@/components/FolderTile";
import { MascotLoader } from "@/components/MascotLoader";
import { SectionLabel } from "@/components/SectionLabel";
import { PrimaryButton } from "@/components/PrimaryButton";
import { updateFolderName } from "@/lib/api";
import { useFolderDetail } from "@/lib/use-folders";
import { useUIStore } from "@/lib/ui-store";
import { safeBack } from "@/lib/safe-back";
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
  const { folder, loading } = useFolderDetail(kind);
  const showToast = useUIStore((s) => s.showToast);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

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
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 8 }}>
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
      </ScrollView>
    </SafeAreaView>
  );
}
