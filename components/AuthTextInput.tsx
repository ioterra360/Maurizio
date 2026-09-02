import { useState } from "react";
import { TextInput, View } from "react-native";
import type { ComponentProps, Ref } from "react";
import { Eye, EyeOff } from "lucide-react-native";

import { Tappable } from "@/components/Tappable";
import { FONT, useColors } from "@/theme/tokens";
import { useT } from "@/lib/i18n";

type AuthTextInputProps = ComponentProps<typeof TextInput> & {
  ref?: Ref<TextInput>;
};

const FIELD_HEIGHT = 54;
const EYE_SLOT = 46;

/**
 * The editorial text input shared by the auth screens (login / signup /
 * forgot-password / reset-password). Owns the unified height and the focus
 * border swap (navy when focused, hairline blurred) so the same field never
 * changes size between screens. Any TextInput prop passes through;
 * onFocus/onBlur are chained so callers can still observe focus.
 *
 * Password fields (`secureTextEntry`) get a show/hide toggle on the right:
 * the eye reveals the typed text so people can check what they set before
 * submitting. The prop still drives the masking; the toggle only flips it.
 */
export function AuthTextInput({
  ref,
  style,
  onFocus,
  onBlur,
  secureTextEntry,
  ...rest
}: AuthTextInputProps) {
  const { t } = useT();
  const colors = useColors();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = Boolean(secureTextEntry);

  const input = (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.placeholder}
      {...rest}
      secureTextEntry={isPassword && !revealed}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className="rounded-input bg-surface px-4 text-body-lg text-navy"
      style={[
        {
          height: FIELD_HEIGHT,
          fontFamily: FONT.medium,
          borderWidth: 1.5,
          borderColor: focused ? colors.accent : colors.hairline,
        },
        isPassword ? { paddingRight: EYE_SLOT + 8 } : null,
        style,
      ]}
    />
  );

  if (!isPassword) return input;

  return (
    <View style={{ position: "relative" }}>
      {input}
      <Tappable
        onPress={() => setRevealed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={revealed ? t("authTextInput.hidePassword") : t("authTextInput.showPassword")}
        hitSlop={8}
        pressedOpacity={0.6}
        containerStyle={{ position: "absolute", right: 4, top: 0 }}
        style={{
          height: FIELD_HEIGHT,
          width: EYE_SLOT,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {revealed ? (
          <EyeOff size={20} color={colors.midGrey} strokeWidth={1.75} />
        ) : (
          <Eye size={20} color={colors.midGrey} strokeWidth={1.75} />
        )}
      </Tappable>
    </View>
  );
}
