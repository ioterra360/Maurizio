import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { HeaderHero } from "@/components/HeaderHero";
import { InitialsAvatar } from "@/components/FolderTile";
import { SectionLabel } from "@/components/SectionLabel";
import { SettingsRow, SettingsToggle } from "@/components/SettingsRow";
import { PrimaryButton } from "@/components/PrimaryButton";
import { GhostButton } from "@/components/GhostButton";
import { useAuthStore } from "@/lib/auth-store";
import { FONT, colors } from "@/theme/tokens";

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const [name, setName] = useState(user?.name ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const initials = (name || "M")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const handleSignOut = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <SafeAreaView className="flex-1 bg-warm-white" edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        <HeaderHero title="Settings" />

        {/* Profile card */}
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
            <InitialsAvatar
              initials={initials}
              size={44}
              variant={user?.role === "admin" ? "admin" : "user"}
            />
            <View className="flex-1" style={{ minWidth: 0 }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor={colors.placeholder}
                style={{
                  fontFamily: FONT.semibold,
                  fontSize: 15,
                  color: colors.navy,
                  letterSpacing: -0.15,
                  padding: 0,
                }}
              />
              <Text
                style={{
                  fontFamily: FONT.regular,
                  fontSize: 12.5,
                  color: colors.midGrey,
                  marginTop: 2,
                }}
              >
                Daily reviewer · since Mar 2026
              </Text>
            </View>
          </View>
        </View>

        {/* Schedule */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Schedule</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <SettingsRow label="Morning review" value="8:00 AM" onPress={() => {}} />
          <SettingsRow label="Evening review" value="9:30 PM" onPress={() => {}} />
        </View>

        {/* Limits */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Limits</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <SettingsRow
            label="Daily input cap"
            hint="Max new memories you can add per day. Keeps load sustainable."
            value="20"
            onPress={() => {}}
          />
        </View>

        {/* Notifications */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>Notifications</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <SettingsToggle
            label="Calm mode"
            hint="No badges. Only the morning nudge."
            defaultOn
          />
          <SettingsToggle
            label="Weekly digest"
            hint="A Sunday summary of what consolidated, what's fading, where to focus."
          />
        </View>

        {/* About */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <SectionLabel>About</SectionLabel>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <SettingsRow label="Version" value="0.1.0" />
          <SettingsRow label="Privacy" value="On-device first" />
        </View>

        {/* Danger zone */}
        <View style={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: 8 }}>
          <Text
            style={{
              fontFamily: FONT.bold,
              fontSize: 10.5,
              color: colors.fading,
              letterSpacing: 1.05, // 0.1em on 10.5px (was 1.4 = too wide)
              textTransform: "uppercase",
            }}
          >
            Danger zone
          </Text>
        </View>
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          <Pressable
            onPress={handleSignOut}
            className="rounded-input bg-surface"
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.hairlineStrong,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 14,
                color: colors.navy,
                letterSpacing: -0.07,
              }}
            >
              Sign out
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 12,
                color: colors.midGrey,
                marginTop: 2,
                lineHeight: 17,
              }}
            >
              You&apos;ll need your email and password to sign back in.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setConfirmDelete(true)}
            className="rounded-input bg-surface"
            style={({ pressed }) => ({
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderWidth: 1,
              borderColor: colors.fading,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: FONT.semibold,
                fontSize: 14,
                color: colors.danger,
                letterSpacing: -0.07,
              }}
            >
              Delete account
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 12,
                color: colors.midGrey,
                marginTop: 2,
                lineHeight: 17,
              }}
            >
              Permanently remove all memories, folders, and review history.
              This can&apos;t be undone.
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Delete confirmation bottom sheet */}
      <Modal
        visible={confirmDelete}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmDelete(false)}
      >
        {/* Backdrop and sheet are SIBLINGS, not nested. React Native's
            Pressable does not honor synthetic e.stopPropagation(), so a
            nested-pressable approach would dismiss the sheet on any tap
            inside it. Here only the backdrop receives taps to close. */}
        <View style={{ flex: 1, justifyContent: "flex-end" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => setConfirmDelete(false)}
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
              paddingHorizontal: 22,
              paddingTop: 16,
              paddingBottom: 32,
              shadowColor: "#0F1B33",
              shadowOpacity: 0.18,
              shadowOffset: { width: 0, height: -8 },
              shadowRadius: 30,
              elevation: 24,
            }}
          >
            <View
              style={{
                alignSelf: "center",
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#D9D7D1",
                marginBottom: 16,
              }}
            />
            <Text
              style={{
                fontFamily: FONT.bold,
                fontSize: 19,
                color: colors.navy,
                lineHeight: 23,
                letterSpacing: -0.4,
              }}
            >
              Delete your Memora account?
            </Text>
            <Text
              style={{
                fontFamily: FONT.regular,
                fontSize: 13.5,
                color: colors.midGrey,
                marginTop: 8,
                lineHeight: 19,
              }}
            >
              779 memories across 4 folders will be permanently deleted.
              You&apos;ll be signed out on every device.
            </Text>
            <View style={{ marginTop: 20, gap: 10 }}>
              <PrimaryButton
                label="Yes, delete everything"
                onPress={() => setConfirmDelete(false)}
                style={{ backgroundColor: colors.danger }}
              />
              <GhostButton
                label="Cancel"
                onPress={() => setConfirmDelete(false)}
                variant="link"
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
