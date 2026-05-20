import { useEffect, useState } from "react";
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
import type { FolderKind } from "@/lib/constants";
import { useUIStore } from "@/lib/ui-store";
import { safeBack } from "@/lib/safe-back";

export default function AddScreen() {
  const folders = getAllFolderSeeds();
  const [folder, setFolder] = useState<FolderKind>("jp");
  const [type, setType] = useState<string>(ITEM_TYPES_BY_KIND.jp[0] ?? "Word");
  const [text, setText] = useState("");
  const [dailyCount, setDailyCount] = useState(12);
  const dailyMax = 20;
  const showToast = useUIStore((s) => s.showToast);

  // Reset type when folder changes if current type isn't valid for the new folder
  useEffect(() => {
    if (!ITEM_TYPES_BY_KIND[folder].includes(type)) {
      setType(ITEM_TYPES_BY_KIND[folder][0] ?? "Word");
    }
  }, [folder, type]);

  const preview = ADD_PREVIEW_BY_KIND[folder];
  const types = ITEM_TYPES_BY_KIND[folder];
  const dailyLimitReached = dailyCount >= dailyMax;
  const canSave = text.trim().length > 0 && !dailyLimitReached;

  const doSave = (addAnother: boolean) => {
    if (!canSave) return;
    setDailyCount((c) => Math.min(c + 1, dailyMax));
    const folderName = folders.find((f) => f.kind === folder)?.name ?? folder;
    showToast(`Saved to ${folderName} · first review tomorrow`);
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
        title="Add to memory"
        onBack={handleBack}
        rightSlot={
          <Pressable
            onPress={() => doSave(false)}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityLabel="Save"
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              opacity: !canSave ? 0.4 : pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 15,
                color: colors.navy,
                letterSpacing: -0.15,
              }}
            >
              Save
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
                  onPress={() => setFolder(f.kind)}
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
                      fontSize: 13,
                      color: on ? "#fff" : colors.navy,
                      letterSpacing: -0.07,
                    }}
                  >
                    {FOLDER_LABELS[f.kind]}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONT.medium,
                      fontSize: 11.5,
                      color: on ? "rgba(255,255,255,0.65)" : colors.midGrey,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    · #{f.priority}
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
              placeholder="What do you want to remember?"
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
              const on = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
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
                      fontSize: 12.5,
                      color: on ? "#fff" : colors.navy,
                      letterSpacing: -0.04,
                    }}
                  >
                    {t}
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
                  Front
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
                  Back
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
                  First review · tomorrow, 8:00 AM
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
            Try to use it in real life today — first review is tomorrow.
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
              fontFamily: FONT.regular,
              fontSize: 12,
              color: dailyLimitReached ? colors.fading : colors.midGrey,
              fontVariant: ["tabular-nums"],
            }}
          >
            {dailyLimitReached
              ? `Daily limit reached · come back tomorrow`
              : `${dailyCount} / ${dailyMax} inputs today`}
          </Text>
          <GhostButton
            label="Save & add another"
            variant="outline"
            onPress={() => doSave(true)}
            disabled={!canSave}
          />
          <PrimaryButton label="Save & continue" onPress={() => doSave(false)} disabled={!canSave} />
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}
