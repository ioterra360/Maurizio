import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Tappable } from "@/components/Tappable";
import { FONT, colors, radii } from "@/theme/tokens";

type RowProps = {
  label: string;
  hint?: string;
  value?: string;
  onPress?: () => void;
};

/**
 * Settings list row: label on the left, optional hint underneath,
 * value on the right. Tappable when an onPress is given; otherwise
 * renders a non-interactive View (no pressed feedback).
 */
export function SettingsRow({ label, hint, value, onPress }: RowProps) {
  if (onPress) {
    return (
      <Tappable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: radii.chip,
          backgroundColor: colors.surface,
          paddingHorizontal: 16,
          paddingVertical: 13,
          gap: 12,
          borderWidth: 1,
          borderColor: colors.hairline,
        }}
      >
        <RowBody label={label} hint={hint} value={value} />
      </Tappable>
    );
  }
  return (
    <View
      className="flex-row items-center justify-between rounded-chip bg-surface"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 13,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <RowBody label={label} hint={hint} value={value} />
    </View>
  );
}

function RowBody({ label, hint, value }: Omit<RowProps, "onPress">) {
  return (
    <>
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          className="text-navy"
          style={{ fontFamily: FONT.medium, fontSize: 15, letterSpacing: -0.07 }}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            className="mt-0.5 text-caption text-mid-grey"
            style={{ fontFamily: FONT.regular, lineHeight: 18 }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text
          style={{
            fontFamily: FONT.medium,
            fontSize: 14.5,
            color: colors.midGrey,
            fontVariant: ["tabular-nums"],
          }}
        >
          {value}
        </Text>
      ) : null}
    </>
  );
}

type ToggleProps = {
  label: string;
  hint?: string;
  defaultOn?: boolean;
  onChange?: (on: boolean) => void;
};

export function SettingsToggle({ label, hint, defaultOn = false, onChange }: ToggleProps) {
  const [on, setOn] = useState(defaultOn);
  return (
    <View
      className="flex-row items-center rounded-chip bg-surface"
      style={{
        paddingHorizontal: 16,
        paddingVertical: 13,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text
          className="text-navy"
          style={{ fontFamily: FONT.medium, fontSize: 15, letterSpacing: -0.07 }}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            className="mt-0.5 text-caption text-mid-grey"
            style={{ fontFamily: FONT.regular, lineHeight: 18 }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <Switch
        value={on}
        onValueChange={(v) => {
          setOn(v);
          onChange?.(v);
        }}
        trackColor={{ false: colors.switchTrackOff, true: colors.active }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.switchTrackOff}
      />
    </View>
  );
}
