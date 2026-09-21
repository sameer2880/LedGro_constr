/**
 * Colours the strip behind the status bar of the native LedGro Android app so it matches the
 * page header in both themes.
 *
 * Inside the Capacitor app, `window.Capacitor` is injected by the native shell and exposes the
 * `LedGroSystemBars` plugin (android/.../LedGroSystemBarsPlugin.java). In a normal browser, a
 * PWA, or an older APK without the plugin, this does nothing.
 *
 * Keep these two in sync with `.site-header` in styles.css.
 */
const HEADER_LIGHT = "#f5f8f0";
const HEADER_DARK = "#0f1c14";

type CapacitorBridge = {
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<unknown>;
};

export function syncNativeStatusBar(isDark: boolean): void {
  if (typeof window === "undefined") return;

  const capacitor = (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
  if (typeof capacitor?.nativePromise !== "function") return;

  try {
    capacitor
      .nativePromise("LedGroSystemBars", "setStatusBar", {
        color: isDark ? HEADER_DARK : HEADER_LIGHT,
      })
      .catch(() => {
        // Older app build without the plugin — the status bar just keeps its default colour.
      });
  } catch {
    // Never let a native-bridge problem break the web app.
  }
}