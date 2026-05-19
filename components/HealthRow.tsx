import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";
import { RetentionBar } from "./RetentionBar";

type Health = "High" | "Medium" | "Low";

type Props = {
  name: string;
  active: number;
  fading: number;
  archived: number;
  chip: Health;
};

const CHIP_STYLES: Record<Health, { bg: string; text: string }> = {
  High:   { bg: "#E7F5EE", text: "#1F8552" },
  Medium: { bg: "#FDEEEA", text: "#A65B4A" },
  Low:    { bg: "#FBE3DD", text: "#9A3F2F" },
};

/**
 * A per-folder line on the Memory Health screen: name + retention bar + chip.
 */
export function HealthRow({ name, active, fading, archived, chip }: Props) {
  const s = CHIP_STYLES[chip];
  return (
    <View
      className="flex-row items-center rounded-chip bg-surface"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <Text
        className="text-navy"
        style={{ fontFamily: FONT.semibold, fontSize: 14, letterSpacing: -0.07, width: 78 }}
      >
        {name}
      </Text>
      <RetentionBar active={active} fading={fading} archived={archived} width={130} height={6} />
      <View style={{ flex: 1 }} />
      <View
        className="rounded-tag"
        style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 4 }}
      >
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 11.5,
            color: s.text,
            letterSpacing: 0.2,
          }}
        >
          {chip}
        </Text>
      </View>
    </View>
  );
}
