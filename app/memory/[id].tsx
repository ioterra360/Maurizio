import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Trash2 } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";

import { MascotLoader } from "@/components/MascotLoader";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionLabel } from "@/components/SectionLabel";
import { Tappable } from "@/components/Tappable";
import { TopBar } from "@/components/TopBar";
import { deleteMemory, fetchMemoryById, updateMemoryNotes } from "@/lib/api";
import { longDate, relativeReviewed } from "@/lib/format";
import { useT } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n";
import type { Memory } from "@/lib/mappers";
import { reportError } from "@/lib/report-error";
import { useUIStore } from "@/lib/ui-store";
import { FONT, colors, radii, statusTint } from "@/theme/tokens";

// Labels are catalog keys, resolved with t() at render so the language switch applies.
const STATE_META: Record<Memory["state"], { bg: string; text: string; labelKey: TKey }> = {
  active: { ...statusTint.active, labelKey: "memory.stateActive" },
  fading: { ...statusTint.fading, labelKey: "memory.stateFading" },
  archived: { ...statusTint.archived, labelKey: "memory.stateArchived" },
};

const NOTES_MAX = 2000;

/**
 * Memory detail sheet — opened by tapping a row in the Folder list.
 * Shows the whole card (term, reading, meaning, example), when it was
 * added and reviewed, and lets the user keep free-text notes ("appunti")
 * about the word. The meaning is shown here only, never in the list
 * (Angelo, 2026-08-27).
 */
export default function MemoryDetailScreen() {
  const { t } = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const showToast = useUIStore((s) => s.showToast);

  const [memory, setMemory] = useState<Memory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savePressed, setSavePressed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(false);
    try {
      const m = await fetchMemoryById(id);
      setMemory(m);
      setNotes(m?.notes ?? "");
      if (!m) setError(true);
    } catch (e) {
      reportError("memory-detail/fetch", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = memory !== null && notes.trim() !== (memory.notes ?? "").trim();

  const save = async () => {
    if (!memory || saving || !dirty) return;
    setSaving(true);
    try {
      const next = notes.trim();
      await updateMemoryNotes(memory.id, next.length ? next : null);
      setMemory({ ...memory, notes: next.length ? next : null });
      showToast(t("memory.notesSaved"));
      if (router.canGoBack()) router.back();
    } catch (e) {
      reportError("memory-detail/save-notes", e);
      showToast(t("memory.notesSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/knowledge");
  };

  const confirmDelete = () => {
    if (!memory || deleting) return;
    Alert.alert(
      t("memory.deleteConfirmTitle", { term: memory.term }),
      t("memory.deleteConfirmMessage"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: () => void doDelete(),
        },
      ],
    );
  };

  const doDelete = async () => {
    if (!memory) return;
    setDeleting(true);
    try {
      await deleteMemory(memory.id);
      showToast(t("memory.deleted"));
      back(); // the folder list refetches on focus
    } catch (e) {
      reportError("memory-detail/delete", e);
      showToast(t("memory.deleteFailed"));
      setDeleting(false);
    }
  };

  const meta = memory ? STATE_META[memory.state] : null;

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar
        title={t("memory.title")}
        onBack={back}
        rightSlot={
          memory ? (
            <Pressable
              onPress={save}
              disabled={saving || !dirty}
              accessibilityRole="button"
              accessibilityLabel={t("memory.saveNotes")}
              hitSlop={10}
              onPressIn={() => setSavePressed(true)}
              onPressOut={() => setSavePressed(false)}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 8,
                opacity: saving || !dirty ? 0.35 : savePressed ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontFamily: FONT.bold,
                  fontSize: 15,
                  lineHeight: 20,
                  color: colors.navy,
                  letterSpacing: -0.1,
                }}
              >
                {t("common.save")}
              </Text>
            </Pressable>
          ) : undefined
        }
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <MascotLoader label={t("memory.opening")} />
        </View>
      ) : error || !memory || !meta ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 12 }}>
          <Text
            style={{ fontFamily: FONT.semibold, fontSize: 15, color: colors.navy, textAlign: "center" }}
          >
            {t("memory.openFailed")}
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
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: 32 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            showsVerticalScrollIndicator={false}
          >
            {/* Term */}
            <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
              <Text
                style={{
                  fontFamily: FONT.bold,
                  fontSize: memory.term.length > 12 ? 32 : 42,
                  lineHeight: memory.term.length > 12 ? 40 : 50,
                  letterSpacing: -1,
                  color: colors.navy,
                  textAlign: "center",
                }}
              >
                {memory.term}
              </Text>
              {memory.reading ? (
                <Text
                  style={{
                    marginTop: 8,
                    fontFamily: FONT.medium,
                    fontSize: 18,
                    color: colors.midGrey,
                    letterSpacing: 0.2,
                    textAlign: "center",
                  }}
                >
                  {memory.reading}
                </Text>
              ) : null}
              <View
                style={{
                  marginTop: 12,
                  backgroundColor: meta.bg,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radii.tag,
                }}
              >
                <Text style={{ fontFamily: FONT.semibold, fontSize: 12, color: meta.text, letterSpacing: 0.2 }}>
                  {t(meta.labelKey)}
                </Text>
              </View>
            </View>

            {/* Meaning + example */}
            <SectionLabel topMargin={22}>{t("memory.sectionMeaning")}</SectionLabel>
            <View
              style={{
                marginTop: 10,
                backgroundColor: colors.surface,
                borderRadius: radii.card,
                borderWidth: 1,
                borderColor: colors.hairline,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
            >
              <Text style={{ fontFamily: FONT.medium, fontSize: 17, lineHeight: 24, color: colors.navy }}>
                {memory.definition}
              </Text>
              {memory.example ? (
                <Text
                  style={{
                    marginTop: 10,
                    fontFamily: FONT.regular,
                    fontSize: 15,
                    lineHeight: 22,
                    fontStyle: "italic",
                    color: colors.navySoft,
                  }}
                >
                  {memory.example}
                </Text>
              ) : null}
            </View>

            {/* Dates */}
            <SectionLabel topMargin={22}>{t("memory.sectionHistory")}</SectionLabel>
            <View
              style={{
                marginTop: 10,
                backgroundColor: colors.surface,
                borderRadius: radii.card,
                borderWidth: 1,
                borderColor: colors.hairline,
              }}
            >
              <MetaRow label={t("memory.addedOn")} value={longDate(memory.createdAt)} />
              <MetaRow
                label={t("memory.lastReview")}
                value={
                  memory.lastReviewedAt ? `${relativeReviewed(memory.lastReviewedAt)}` : t("common.never")
                }
              />
              <MetaRow label={t("memory.nextReview")} value={longDate(memory.nextReviewAt)} last />
            </View>

            {/* Notes */}
            <SectionLabel topMargin={22}>{t("memory.notes")}</SectionLabel>
            <TextInput
              value={notes}
              onChangeText={(v) => setNotes(v.slice(0, NOTES_MAX))}
              multiline
              textAlignVertical="top"
              placeholder={t("memory.notesPlaceholder")}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={t("memory.notes")}
              style={{
                marginTop: 10,
                minHeight: 140,
                backgroundColor: colors.surface,
                borderRadius: radii.input,
                borderWidth: 1,
                borderColor: colors.hairline,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontFamily: FONT.regular,
                fontSize: 15.5,
                lineHeight: 22,
                color: colors.navy,
              }}
            />
            <Text
              style={{
                marginTop: 6,
                alignSelf: "flex-end",
                fontFamily: FONT.regular,
                fontSize: 11.5,
                color: colors.placeholder,
                fontVariant: ["tabular-nums"],
              }}
            >
              {notes.length} / {NOTES_MAX}
            </Text>

            <View style={{ marginTop: 18 }}>
              <PrimaryButton label={t("memory.saveNotes")} onPress={save} loading={saving} disabled={!dirty} />
            </View>

            {/* Danger zone */}
            <Tappable
              onPress={confirmDelete}
              disabled={deleting || saving}
              accessibilityRole="button"
              accessibilityLabel={t("memory.deleteMemory")}
              pressedOpacity={0.8}
              containerStyle={{ marginTop: 34, opacity: deleting ? 0.5 : 1 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 52,
                borderRadius: radii.cta,
                borderWidth: 1.5,
                borderColor: colors.danger,
                backgroundColor: colors.dangerSoft,
              }}
            >
              <Trash2 size={17} color={colors.danger} strokeWidth={2} />
              <Text style={{ fontFamily: FONT.semibold, fontSize: 15.5, color: colors.danger }}>
                {deleting ? t("memory.deleting") : t("memory.deleteMemory")}
              </Text>
            </Tappable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MetaRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.divider,
        gap: 12,
      }}
    >
      <Text style={{ fontFamily: FONT.regular, fontSize: 14.5, color: colors.midGrey }}>{label}</Text>
      <Text
        style={{ fontFamily: FONT.semibold, fontSize: 14.5, color: colors.navy, flexShrink: 1, textAlign: "right" }}
      >
        {value}
      </Text>
    </View>
  );
}
