import { useState } from "react";
import { TextInput } from "react-native";
import type { ComponentProps, Ref } from "react";

import { colors, FONT } from "@/theme/tokens";

type AuthTextInputProps = ComponentProps<typeof TextInput> & {
  ref?: Ref<TextInput>;
};

/**
 * The editorial text input shared by the auth screens (login / signup /
 * forgot-password). Owns the unified 50px height and the focus border swap
 * (navy when focused, hairline blurred) so the same field never changes
 * size between screens. Any TextInput prop passes through; onFocus/onBlur
 * are chained so callers can still observe focus if they need to.
 */
export function AuthTextInput({ ref, style, onFocus, onBlur, ...rest }: AuthTextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.placeholder}
      {...rest}
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
          height: 50,
          fontFamily: FONT.medium,
          borderWidth: 1.5,
          borderColor: focused ? colors.navy : colors.hairline,
        },
        style,
      ]}
    />
  );
}
