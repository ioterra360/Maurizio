import { Text, View } from "react-native";
import { Plus, Scale, Stethoscope } from "lucide-react-native";
import { FONT, colors } from "@/theme/tokens";
import type { FolderKind } from "@/lib/constants";

type Props = {
  kind: FolderKind | "add";
  size?: number;
};

/**
 * The small folder identity glyph used in Knowledge list and Folder detail.
 * Each kind has its own soft-tint background and icon/emoji.
 */
export function FolderTile({ kind, size = 32 }: Props) {
  const base = {
    width: size,
    height: size,
    borderRadius: 9,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  if (kind === "jp") {
    return (
      <View style={[base, { backgroundColor: "#FCE9E9" }]}>
        <Text style={{ fontSize: size * 0.62 }}>🇯🇵</Text>
      </View>
    );
  }
  if (kind === "es") {
    return (
      <View style={[base, { backgroundColor: "#FDF1E0" }]}>
        <Text style={{ fontSize: size * 0.62 }}>🇪🇸</Text>
      </View>
    );
  }
  if (kind === "medicine") {
    return (
      <View style={[base, { backgroundColor: "#E8F5EE" }]}>
        <Stethoscope size={size * 0.55} color={colors.active} strokeWidth={2} />
      </View>
    );
  }
  if (kind === "law") {
    return (
      <View style={[base, { backgroundColor: "#EEEAFB" }]}>
        <Scale size={size * 0.55} color={colors.navy} strokeWidth={1.8} />
      </View>
    );
  }
  // "add" — placeholder for "Add a folder" tile
  return (
    <View
      style={[
        base,
        { backgroundColor: "transparent", borderWidth: 1.2, borderColor: colors.hairlineStrong, borderStyle: "dashed" },
      ]}
    >
      <Plus size={size * 0.5} color={colors.midGrey} strokeWidth={1.8} />
    </View>
  );
}

/**
 * The 2-letter "initials" badge used for user avatars / role tags.
 */
export function InitialsAvatar({
  initials,
  size = 36,
  variant = "user",
}: {
  initials: string;
  size?: number;
  variant?: "user" | "admin";
}) {
  const isAdmin = variant === "admin";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: isAdmin ? colors.navy : colors.tagUserBg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: FONT.semibold,
          fontSize: size * 0.36,
          color: isAdmin ? colors.warmWhite : colors.navy,
          letterSpacing: 0.4,
        }}
      >
        {initials}
      </Text>
    </View>
  );
}
