// Vitest stub for `react-native` — lib/ modules that reach the i18n layer
// import Platform/I18nManager/NativeModules; tests run in Node with an
// Italian device locale so existing Italian expectations keep holding.
export const Platform = { OS: "android" as const, select: <T,>(o: { android?: T; ios?: T; default?: T }) => o.android ?? o.default };
export const I18nManager = { getConstants: () => ({ localeIdentifier: "it_IT" }), isRTL: false };
export const NativeModules: Record<string, unknown> = {};
