import { Text, View } from "react-native";
import { FONT, colors } from "@/theme/tokens";
import type { FolderItem } from "@/lib/folder-data";

const STATE_META = {
  active:   { dot: colors.active,   bg: "#E7F5EE", text: "#1F8552", label: "Active" },
  fading:   { dot: colors.fading,   bg: "#FDEEEA", text: "#A65B4A", label: "Fading" },
  archived: { dot: "#9C9C95",       bg: "#EFEDE7", text: "#7A7975", label: "Archived" },
} as const;

const isCjk = (s: string) => /[　-鿿]/.test(s);

type Props = {
  item: FolderItem;
};

/**
 * One memory line in the Folder detail list. State dot on the left,
 * term + back text + last-reviewed, and a state chip on the right.
 */
export function ItemRow({ item }: Props) {
  const meta = STATE_META[item.state];
  const cjk = isCjk(item.front);

  return (
    <View
      className="flex-row items-start rounded-chip bg-surface"
      style={{
        paddingHorizontal: 14,
        paddingVertical: 13,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: meta.dot,
          marginTop: 7,
        }}
      />

      <View className="flex-1" style={{ minWidth: 0 }}>
        <View className="flex-row flex-wrap items-baseline" style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: FONT.semibold,
              fontSize: cjk ? 17 : 15,
              color: colors.navy,
              letterSpacing: -0.1,
            }}
          >
            {item.front}
          </Text>
          {item.reading ? (
            <Text
              style={{
                fontFamily: FONT.medium,
                fontSize: 12,
                color: colors.midGrey,
                letterSpacing: 0.1,
              }}
            >
              {item.reading}
            </Text>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: FONT.regular,
            fontSize: 13,
            color: colors.midGrey,
            marginTop: 3,
            lineHeight: 18,
          }}
        >
          {item.back}
        </Text>
        <Text
          style={{
            fontFamily: FONT.regular,
            fontSize: 11.5,
            color: "#B0AFAA",
            marginTop: 5,
            fontVariant: ["tabular-nums"],
          }}
        >
          Reviewed {item.reviewed}
        </Text>
      </View>

      <View
        className="rounded-tag"
        style={{
          backgroundColor: meta.bg,
          paddingHorizontal: 8,
          paddingVertical: 3,
        }}
      >
        <Text
          style={{
            fontFamily: FONT.semibold,
            fontSize: 11,
            color: meta.text,
            letterSpacing: 0.2,
          }}
        >
          {meta.label}
        </Text>
      </View>
    </View>
  );
}
