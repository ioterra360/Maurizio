import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";

import { GhostButton } from "@/components/GhostButton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useT } from "@/lib/i18n";
import { FONT, radii, useColors } from "@/theme/tokens";

const NAME_MAX = 24;

/**
 * Piccola modale con un campo nome — usata per creare/rinominare le
 * sottocartelle. Stesso pattern backdrop+foglio di settings.tsx (fratelli,
 * non annidati: Pressable non onora stopPropagation).
 */
export function NamePromptModal({
  visible,
  title,
  initialValue = "",
  placeholder,
  saving = false,
  onSave,
  onClose,
}: {
  visible: boolean;
  title: string;
  initialValue?: string;
  placeholder: string;
  saving?: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const colors = useColors();
  const [name, setName] = useState(initialValue);

  // Reseed the field each time the modal opens for a different target.
  useEffect(() => {
    if (visible) setName(initialValue);
  }, [visible, initialValue]);

  const trimmed = name.trim();
  const canSave = !saving && trimmed.length > 0 && trimmed.length <= NAME_MAX;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            onPress={() => {
              if (!saving) onClose();
            }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(26,44,79,0.45)",
            }}
          />
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
              style={{ fontFamily: FONT.bold, fontSize: 19, color: colors.navy, letterSpacing: -0.3 }}
            >
              {title}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={NAME_MAX + 6}
              placeholder={placeholder}
              placeholderTextColor={colors.placeholder}
              accessibilityLabel={placeholder}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSave) onSave(trimmed);
              }}
              style={{
                height: 50,
                borderRadius: radii.input,
                backgroundColor: colors.surface,
                borderWidth: 1.5,
                borderColor: colors.navy,
                paddingHorizontal: 14,
                fontFamily: FONT.medium,
                fontSize: 16,
                color: colors.navy,
              }}
            />
            <Text
              style={{
                alignSelf: "flex-end",
                fontFamily: FONT.regular,
                fontSize: 11.5,
                color: trimmed.length > NAME_MAX ? colors.danger : colors.midGrey,
                fontVariant: ["tabular-nums"],
              }}
            >
              {trimmed.length} / {NAME_MAX}
            </Text>
            <View style={{ gap: 10 }}>
              <PrimaryButton
                label={t("common.save")}
                onPress={() => onSave(trimmed)}
                loading={saving}
                disabled={!canSave}
              />
              <GhostButton label={t("common.cancel")} onPress={onClose} disabled={saving} />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
