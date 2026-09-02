/**
 * Le due tavolozze di Memika — chiara (l'editoriale storica, INVARIATA) e
 * scura (derivata dal mockup Home di Maurizio, 2026-09-01).
 *
 * Sdoppiamento dei ruoli (spec 2026-09-02 §F1): `navy` faceva due mestieri —
 * testo principale E riempimento dei bottoni. In chiaro coincidono, in scuro
 * no: il testo diventa quasi bianco, il bottone resta blu. Da qui i token
 * `textPrimary` / `accent` / `onAccent` / `bgScreen`; i vecchi nomi (navy,
 * warmWhite, midGrey) restano come ALIAS del loro ruolo di testo/sfondo.
 *
 * Regola: MAI leggere questi oggetti direttamente da un componente — passare
 * da useColors()/useThemeTokens() (theme/theme-store.ts) così il cambio tema
 * si applica al volo. L'export statico in tokens.ts esiste solo per il
 * codice non ancora convertito e per i default di modulo.
 */

export type StatusTintPair = { bg: string; text: string };

export type ThemeColors = {
  // Ruoli (nuovi, 2026-09-02).
  textPrimary: string;
  textSecondary: string;
  accent: string;
  onAccent: string;
  bgScreen: string;
  // Alias storici — stessi valori dei ruoli, per il codice esistente.
  navy: string;
  navySoft: string;
  canvas: string;
  warmWhite: string;
  surface: string;
  midGrey: string;
  placeholder: string;
  hairline: string;
  hairlineStrong: string;
  divider: string;
  dotIdle: string;
  switchTrackOff: string;
  scan: string;
  reinforcement: string;
  focus: string;
  active: string;
  fading: string;
  archived: string;
  danger: string;
  dangerSoft: string;
  tagUserBg: string;
  tagProBg: string;
  tagProText: string;
};

export type ThemeTokens = {
  colors: ThemeColors;
  palette: { green: string; peach: string; violet: string; blue: string };
  layerTint: { scan: string; reinforcement: string; focus: string; scanReveal: string };
  folderTint: { jp: string; es: string; medicine: string; law: string; custom: string };
  statusTint: { active: StatusTintPair; fading: StatusTintPair; archived: StatusTintPair };
  severityTint: { med: StatusTintPair };
  layer: {
    scan: { color: string; label: string; icon: string };
    reinforcement: { color: string; label: string; icon: string };
    focus: { color: string; label: string; icon: string };
  };
};

const lightColors: ThemeColors = {
  textPrimary: "#1A2C4F",
  textSecondary: "#8A8A88",
  accent: "#1A2C4F",
  onAccent: "#FAF8F4",
  bgScreen: "#FAF8F4",
  navy: "#1A2C4F",
  navySoft: "#243C6B",
  canvas: "#F5F3EF",
  warmWhite: "#FAF8F4",
  surface: "#FFFFFF",
  midGrey: "#8A8A88",
  placeholder: "#B5B3AE",
  hairline: "rgba(26,44,79,0.08)",
  hairlineStrong: "rgba(26,44,79,0.14)",
  divider: "#EFEDE7",
  dotIdle: "#DCDAD3",
  switchTrackOff: "#D9D7D1",
  scan: "#6DA8E5",
  reinforcement: "#9B8CE8",
  focus: "#1A2C4F",
  active: "#3EC07B",
  fading: "#F5A89C",
  archived: "#9C9C95",
  danger: "#B04A38",
  dangerSoft: "#FDEEEA",
  tagUserBg: "#EDF0F6",
  tagProBg: "#EEEAFB",
  tagProText: "#5A4DB1",
};

export const light: ThemeTokens = {
  colors: lightColors,
  palette: {
    green: lightColors.active,
    peach: lightColors.fading,
    violet: lightColors.reinforcement,
    blue: lightColors.scan,
  },
  layerTint: {
    scan: "#E6F0FA",
    reinforcement: "#F1EEFC",
    focus: "#EDF0F6",
    scanReveal: "#EDF4FB",
  },
  folderTint: {
    jp: "#FCE9E9",
    es: "#FDF1E0",
    medicine: "#E8F5EE",
    law: "#EEEAFB",
    custom: "#F1EFE9",
  },
  statusTint: {
    active: { bg: "#E7F5EE", text: "#1F8552" },
    fading: { bg: "#FDEEEA", text: "#A65B4A" },
    archived: { bg: "#EFEDE7", text: "#7A7975" },
  },
  severityTint: {
    med: { bg: "#FDF2EA", text: "#A65B4A" },
  },
  layer: {
    scan: { color: lightColors.scan, label: "Scan", icon: "Radar" },
    reinforcement: { color: lightColors.reinforcement, label: "Reinforcement", icon: "Repeat" },
    focus: { color: lightColors.focus, label: "Focus", icon: "Target" },
  },
};

const darkColors: ThemeColors = {
  textPrimary: "#EDEFF4",
  textSecondary: "#8E96A8",
  accent: "#3B6BF5",
  onAccent: "#FFFFFF",
  bgScreen: "#0E1015",
  // Alias: in scuro navy È il testo primario, warmWhite È lo sfondo.
  navy: "#EDEFF4",
  navySoft: "#C6CDE0",
  canvas: "#08090C",
  warmWhite: "#0E1015",
  surface: "#171A22",
  midGrey: "#8E96A8",
  placeholder: "#5C6270",
  hairline: "rgba(255,255,255,0.08)",
  hairlineStrong: "rgba(255,255,255,0.14)",
  divider: "#23262F",
  dotIdle: "#2A2E3A",
  switchTrackOff: "#2A2E3A",
  scan: "#7FB4E9",
  reinforcement: "#A89BEF",
  focus: "#8FA6D9",
  active: "#4CCB8A",
  fading: "#F0A091",
  archived: "#8B8B84",
  danger: "#E2705A",
  dangerSoft: "#2A1714",
  tagUserBg: "#1D2330",
  tagProBg: "#241F3D",
  tagProText: "#B9AEF5",
};

export const dark: ThemeTokens = {
  colors: darkColors,
  palette: {
    green: darkColors.active,
    peach: darkColors.fading,
    violet: darkColors.reinforcement,
    blue: darkColors.scan,
  },
  layerTint: {
    scan: "#14202E",
    reinforcement: "#1D1930",
    focus: "#161B27",
    scanReveal: "#101C2B",
  },
  folderTint: {
    jp: "#2A1B1B",
    es: "#2A2315",
    medicine: "#12251C",
    law: "#1E1930",
    custom: "#20201B",
  },
  statusTint: {
    active: { bg: "#10291C", text: "#58D695" },
    fading: { bg: "#2A1714", text: "#F0A091" },
    archived: { bg: "#23262F", text: "#9AA0AC" },
  },
  severityTint: {
    med: { bg: "#2A2014", text: "#E0A57E" },
  },
  layer: {
    scan: { color: darkColors.scan, label: "Scan", icon: "Radar" },
    reinforcement: { color: darkColors.reinforcement, label: "Reinforcement", icon: "Repeat" },
    focus: { color: darkColors.focus, label: "Focus", icon: "Target" },
  },
};

export const PALETTES = { light, dark } as const;
export type ThemeScheme = keyof typeof PALETTES;
