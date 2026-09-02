import { useCallback, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CornerUpLeft, FolderPlus, Layers } from "lucide-react-native";

import { FolderTile } from "@/components/FolderTile";
import { MascotLoader } from "@/components/MascotLoader";
import { Tappable } from "@/components/Tappable";
import { fetchFolders, fetchSubfolders, moveMemory } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { FOLDER_KINDS, type FolderKind } from "@/lib/constants";
import { useT } from "@/lib/i18n";
import type { Folder, Memory, Subfolder } from "@/lib/mappers";
import { reportError } from "@/lib/report-error";
import { useUIStore } from "@/lib/ui-store";
import { FONT, colors, radii } from "@/theme/tokens";

const tileKind = (kind: string): FolderKind =>
  ((FOLDER_KINDS as readonly string[]).includes(kind) ? kind : "custom") as FolderKind;

/**
 * "Sposta in un'altra cartella" (Angelo, 2026-08-31): foglio dal basso con
 * le sezioni della cartella attuale (riassegnazione), le altre cartelle
 * (spostamento alla radice) e "Nuova cartella…" che passa da /choose-topic
 * con moveMemoryId — al ritorno la parola è già nella cartella nuova.
 * Appunti, stato SRS e storia viaggiano con la parola.
 */
export function MoveSheet({
  visible,
  memory,
  onClose,
  onMoved,
}: {
  visible: boolean;
  memory: Memory;
  onClose: () => void;
  /** Called after a successful move with the destination label. */
  onMoved: (destinationName: string) => void;
}) {
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const showToast = useUIStore((s) => s.showToast);

  const [folders, setFolders] = useState<Folder[] | null>(null);
  const [subfolders, setSubfolders] = useState<Subfolder[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [fs, subs] = await Promise.all([
        fetchFolders(user.id),
        fetchSubfolders(memory.folderId),
      ]);
      setFolders(fs);
      setSubfolders(subs);
    } catch (e) {
      reportError("move-sheet/load", e);
      setFolders([]);
      setSubfolders([]);
    }
  }, [user, memory.folderId]);

  useEffect(() => {
    if (visible) {
      setFolders(null);
      setBusy(false); // il foglio resta montato: senza reset restava disabilitato
      void load();
    }
  }, [visible, load]);

  const move = async (target: { folderId: string; subfolderId?: string | null }, label: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await moveMemory(memory.id, target);
      onMoved(label);
    } catch (e) {
      reportError("move-sheet/move", e);
      showToast(t("move.failed"));
    } finally {
      // Sempre: il componente sopravvive alla chiusura (prop visible).
      setBusy(false);
    }
  };

  const currentFolder = folders?.find((f) => f.id === memory.folderId) ?? null;
  const otherFolders = (folders ?? []).filter((f) => f.id !== memory.folderId);
  const sectionTargets = subfolders.filter((s) => s.id !== (memory.subfolderId ?? null));
  const showRoot = memory.subfolderId !== null && memory.subfolderId !== undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("common.close")}
          onPress={() => {
            if (!busy) onClose();
          }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15,27,51,0.32)",
          }}
        />
        <View
          style={{
            backgroundColor: colors.warmWhite,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 30,
            maxHeight: "78%",
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#D9D7D1",
              marginBottom: 14,
            }}
          />
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 20,
              color: colors.navy,
              letterSpacing: -0.35,
              marginBottom: 4,
            }}
          >
            {t("move.title", { term: memory.term })}
          </Text>

          {folders === null ? (
            <View style={{ paddingVertical: 36, alignItems: "center" }}>
              <MascotLoader label={t("common.oneMoment")} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {(sectionTargets.length > 0 || showRoot) && currentFolder ? (
                <>
                  <SheetLabel text={t("move.sectionsHere", { name: currentFolder.name })} />
                  {showRoot ? (
                    <SheetRow
                      icon={<CornerUpLeft size={18} color={colors.navy} strokeWidth={1.9} />}
                      label={t("move.rootOfFolder")}
                      disabled={busy}
                      onPress={() =>
                        void move({ folderId: memory.folderId, subfolderId: null }, currentFolder.name)
                      }
                    />
                  ) : null}
                  {sectionTargets.map((s) => (
                    <SheetRow
                      key={s.id}
                      icon={<Layers size={18} color={colors.navy} strokeWidth={1.9} />}
                      label={s.name}
                      disabled={busy}
                      onPress={() =>
                        void move({ folderId: memory.folderId, subfolderId: s.id }, s.name)
                      }
                    />
                  ))}
                </>
              ) : null}

              {otherFolders.length > 0 ? (
                <>
                  <SheetLabel text={t("move.otherFolders")} />
                  {otherFolders.map((f) => (
                    <SheetRow
                      key={f.id}
                      icon={<FolderTile emoji={f.emoji} size={28} />}
                      label={f.name}
                      disabled={busy}
                      onPress={() => void move({ folderId: f.id }, f.name)}
                    />
                  ))}
                </>
              ) : null}

              <SheetLabel text={t("move.orNew")} />
              <SheetRow
                icon={<FolderPlus size={18} color={colors.navy} strokeWidth={1.9} />}
                label={t("move.newFolder")}
                disabled={busy}
                onPress={() => {
                  onClose();
                  router.push({
                    pathname: "/choose-topic",
                    params: { mode: "new", moveMemoryId: memory.id },
                  } as never);
                }}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function SheetLabel({ text }: { text: string }) {
  return (
    <Text
      style={{
        marginTop: 14,
        marginBottom: 8,
        fontFamily: FONT.bold,
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        color: colors.midGrey,
      }}
    >
      {text}
    </Text>
  );
}

function SheetRow({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Tappable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      pressedOpacity={0.85}
      containerStyle={{ marginBottom: 8, opacity: disabled ? 0.6 : 1 }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.surface,
        borderRadius: radii.card,
        borderWidth: 1,
        borderColor: colors.hairline,
        paddingHorizontal: 14,
        paddingVertical: 13,
      }}
    >
      <View style={{ width: 30, alignItems: "center" }}>{icon}</View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: FONT.semibold,
          fontSize: 15,
          color: colors.navy,
          letterSpacing: -0.15,
        }}
      >
        {label}
      </Text>
    </Tappable>
  );
}
