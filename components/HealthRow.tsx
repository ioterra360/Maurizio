import { Text, View } from "react-native";
import { FONT, colors, statusTint } from "@/theme/tokens";
import { RetentionBar } from "./RetentionBar";

type Health = "Alta" | "Media" | "Bassa";

type Props = {
  name: string;
  active: number;
  fading: number;
  archived: number;
  chip: Health;
};

const CHIP_STYLES: Record<Health, { bg: string; text: string }> = {
  Alta:  statusTint.active,
  Media: statusTint.fading,
  Bassa: { bg: "#FBE3DD", text: "#9A3F2F" },
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
        numberOfLines={1}
        // The name takes all the slack (bar and chip are fixed width) instead
        // of a fixed 84 px column that ellipsised "Giapponese" on every phone.
        style={{ fontFamily: FONT.semibold, fontSize: 15, letterSpacing: -0.07, flex: 1, minWidth: 84 }}
      >
        {name}
      </Text>
      <RetentionBar active={active} fading={fading} archived={archived} width={130} height={6} />
      <View
        className="rounded-tag"
        style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 4 }}
      >
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 12.5,
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
