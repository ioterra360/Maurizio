import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect, useLocalSearchParams } from "expo-router";

import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import {
  ADD_PREVIEW_BY_KIND,
  FOLDER_LABELS,
  getAllFolderSeeds,
  ITEM_TYPES_BY_KIND,
} from "@/lib/folder-data";
import { FONT, colors } from "@/theme/tokens";
import { FOLDER_KINDS, type FolderKind } from "@/lib/constants";
import { applyFolderOrder, priorityOf, useFolderOrderStore } from "@/lib/folder-order-store";
import { useAuthStore } from "@/lib/auth-store";
import { useUIStore } from "@/lib/ui-store";
import { safeBack } from "@/lib/safe-back";
import { consumeIntentionalAddOpen } from "@/lib/add-gate";

export default function AddScreen() {
  // Add is a root-level modal (declared in app/_layout.tsx so it can slide
  // up over the tab bar), so it sits OUTSIDE the (app) auth gate. Guard
  // here explicitly — without this, a not-yet-logged-in user could land
  // on Add via state restoration or a deep link and never see /login.
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  // Single-shot gate: if the modal mounted from Expo Router's state
  // restoration on a fast-refresh / shake-Reload (rather than from a user
  // tap on a FAB), bounce out — the user shouldn't be dumped into "create
  // memory" by reloading. See lib/add-gate.ts for the full rationale.
  const [wasOpenedIntentionally] = useState(() => consumeIntentionalAddOpen());
  // Preselect the originating folder when pushed from folder detail;
  // fall back to the first seed folder for paramless opens (Knowledge FAB).
  const params = useLocalSearchParams<{ kind?: string }>();
  const initialKind = (FOLDER_KINDS as readonly string[]).includes(params.kind ?? "")
    ? (params.kind as FolderKind)
    : "jp";
  // Add lives outside the (app) group, so hydrate the persisted folder
  // order here too — the pill row and #N suffixes must match Knowledge.
  const order = useFolderOrderStore((s) => s.order);
  const orderHydrated = useFolderOrderStore((s) => s.hydrated);
  const hydrateOrder = useFolderOrderStore((s) => s.hydrate);
  useEffect(() => {
    if (!orderHydrated) void hydrateOrder();
  }, [orderHydrated, hydrateOrder]);
  const folders = useMemo(() => applyFolderOrder(getAllFolderSeeds(), order), [order]);
  const [folder, setFolder] = useState<FolderKind>(initialKind);
  const [type, setType] = useState<string>(
    ITEM_TYPES_BY_KIND[initialKind][0]?.value ?? "word",
  );
  const [text, setText] = useState("");
  const [dailyCount, setDailyCount] = useState(12);
  const dailyMax = 20;
  const showToast = useUIStore((s) => s.showToast);

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/login" />;
  if (!wasOpenedIntentionally) return <Redirect href="/(app)/today" />;

  const preview = ADD_PREVIEW_BY_KIND[folder];
  const types = ITEM_TYPES_BY_KIND[folder];
  const dailyLimitReached = dailyCount >= dailyMax;
  const canSave = text.trim().length > 0 && !dailyLimitReached;

  const doSave = (addAnother: boolean) => {
    if (!canSave) return;
    setDailyCount((c) => Math.min(c + 1, dailyMax));
    const folderName = folders.find((f) => f.kind === folder)?.name ?? folder;
    showToast(`Salvato in ${folderName} · primo ripasso domani`);
    if (addAnother) {
      setText("");
      // Keep the textarea focused for fast successive adds; no nav.
    } else {
      // Toast is rendered at the root layout — it survives this unmount.
      // safeBack dismisses the keyboard first to avoid an Android race that
      // leaves the IME attached to the unmounted TextInput.
      safeBack("/(app)/knowledge");
    }
  };

  const handleBack = () => safeBack("/(app)/knowledge");

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <TopBar
        title="Nuovo ricordo"
        onBack={handleBack}
        rightSlot={
          <Pressable
            onPress={() => doSave(false)}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Salva"
            hitSlop={10}
            style={({ pressed }) => ({
              paddingHorizontal: 8,
              paddingVertical: 8,
              opacity: !canSave ? 0.35 : pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 15,
                color: colors.navy,
                letterSpacing: -0.1,
              }}
            >
              Salva
            </Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        // Android needs "height" here, not undefined — without it the soft
        // keyboard covers the pinned Save buttons and the screen feels
        // frozen because the only visible action is unreachable.
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 200 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          {/* Folder pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 12 }}
          >
            {folders.map((f) => {
              const on = folder === f.kind;
              return (
                <Pressable
                  key={f.kind}
                  onPress={() => {
                    setFolder(f.kind);
                    // Reset the type if it isn't valid for the new folder —
                    // done here (not in an effect) so both states update in
                    // one batched render, with no invalid-type frame.
                    const ts = ITEM_TYPES_BY_KIND[f.kind];
                    if (!ts.some((t) => t.value === type)) {
                      setType(ts[0]?.value ?? "word");
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className="flex-row items-center rounded-chip"
                  style={({ pressed }) => ({
                    height: 36,
                    paddingHorizontal: 12,
                    gap: 6,
                    backgroundColor: on ? colors.navy : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                    opacity: pressed && !on ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 14,
                      color: on ? colors.warmWhite : colors.navy,
                      letterSpacing: -0.07,
                    }}
                  >
                    {FOLDER_LABELS[f.kind]}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.medium,
                      fontSize: 12,
                      color: on ? "rgba(250,248,244,0.72)" : colors.midGrey,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    · #{priorityOf(f.kind, order)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Textarea */}
          <View style={{ paddingHorizontal: 18 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Cosa vuoi ricordare?"
              placeholderTextColor={colors.placeholder}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: colors.surface,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.hairline,
                padding: 16,
                minHeight: 120,
                fontFamily: FONT.regular,
                fontSize: 16,
                color: colors.navy,
                lineHeight: 22,
                letterSpacing: -0.07,
              }}
            />
          </View>

          {/* Type chips */}
          <View
            className="flex-row"
            style={{ paddingHorizontal: 18, paddingTop: 14, gap: 6 }}
          >
            {types.map((t) => {
              const on = type === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => setType(t.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className="flex-1 items-center justify-center rounded-chip"
                  style={({ pressed }) => ({
                    height: 32,
                    backgroundColor: on ? colors.navy : colors.surface,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.hairline,
                    opacity: pressed && !on ? 0.6 : 1,
                  })}
                >
                  <Text
                    style={{
                      fontFamily: on ? FONT.semibold : FONT.medium,
                      fontSize: 13,
                      color: on ? colors.warmWhite : colors.navy,
                      letterSpacing: -0.04,
                    }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Auto preview card */}
          <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
            <View
              className="rounded-card bg-surface"
              style={{
                borderWidth: 1,
                borderColor: colors.hairline,
                overflow: "hidden",
              }}
            >
              <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }}>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 11,
                    color: colors.midGrey,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  Fronte
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 20,
                    color: colors.navy,
                    marginTop: 4,
                    letterSpacing: -0.4,
                  }}
                >
                  {text.trim().length > 0
                    ? text.trim().split("\n")[0]?.slice(0, 60)
                    : preview.front}
                </Text>
              </View>
              <View style={{ height: 1, backgroundColor: colors.divider, marginHorizontal: 16 }} />
              <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <Text
                  style={{
                    fontFamily: FONT.semibold,
                    fontSize: 11,
                    color: colors.midGrey,
                    letterSpacing: 1.1,
                    textTransform: "uppercase",
                  }}
                >
                  Retro
                </Text>
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 14,
                    color: colors.navy,
                    marginTop: 4,
                    lineHeight: 20,
                  }}
                >
                  {preview.back}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  backgroundColor: "#F7F5F0",
                  borderTopWidth: 1,
                  borderTopColor: colors.hairline,
                }}
              >
                <Text
                  style={{
                    fontFamily: FONT.regular,
                    fontSize: 12,
                    color: colors.midGrey,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  Primo ripasso · domani, 8:00
                </Text>
              </View>
            </View>
          </View>

          <Text
            style={{
              paddingHorizontal: 22,
              paddingTop: 12,
              fontFamily: FONT.regular,
              fontSize: 12.5,
              color: colors.midGrey,
              lineHeight: 17,
            }}
          >
            Prova a usarlo nella vita reale oggi — il primo ripasso è domani.
          </Text>
        </ScrollView>

        {/* Pinned bottom actions */}
        <View
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            bottom: 24,
            gap: 10,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              fontFamily: dailyLimitReached ? FONT.medium : FONT.regular,
              fontSize: dailyLimitReached ? 12.5 : 12,
              color: dailyLimitReached ? colors.danger : colors.midGrey,
              fontVariant: ["tabular-nums"],
            }}
          >
            {dailyLimitReached
              ? `Limite giornaliero raggiunto · torna domani`
              : `${dailyCount} / ${dailyMax} ricordi oggi`}
          </Text>
          <GhostButton
            label="Salva e aggiungi un altro"
            variant="outline"
            onPress={() => doSave(true)}
            disabled={!canSave}
          />
          <PrimaryButton label="Salva e continua" onPress={() => doSave(false)} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}
