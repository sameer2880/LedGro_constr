import { useEffect, useState } from "react";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/brand";
import { Link } from "@tanstack/react-router";
import { Download, Home, Moon, Receipt, ShieldCheck, Sun, Truck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import { BrandName } from "@/components/BrandName";

// Keep in sync with the AndroidManifest `package` in the shipped APK.
const ANDROID_PACKAGE = "com.mbscentring.works";
const APK_URL = "/downloads/mbs-works.apk";
const APP_VERSION = "1.0";

type Device = "android" | "ios" | "desktop";

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  return "desktop";
}

function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("mbs-theme", next ? "dark" : "light");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next ? "#0e1911" : "#f3f6ee");
  };

  return { dark, toggleTheme };
}

/* ------------------------------------------------------------------ */
/* Platform symbols (Android robot, Apple logo, desktop monitor)       */
/* Android + Apple paths are from Simple Icons (CC0).                  */
/* ------------------------------------------------------------------ */
type IconProps = { className?: string };

function AndroidIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" />
    </svg>
  );
}

function AppleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function DesktopIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2.5" />
      <rect x="8" y="19.5" width="8" height="2" rx="1" />
    </svg>
  );
}

/* "Your device" dot: pop-in, two ripple rings and a breathing glow —
   the same treatment the animated brand logo uses. */
const LIVE_DOT_CSS = `
.live-dot {
  display: inline-flex;
  width: 10px;
  height: 10px;
  align-items: center;
  justify-content: center;
  animation: live-dot-pop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}
.live-dot-core {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: radial-gradient(circle at 30% 30%, var(--accent), var(--primary) 70%);
  box-shadow: 0 0 8px 1px color-mix(in oklab, var(--primary) 70%, transparent);
  animation: live-dot-breathe 2.4s ease-in-out infinite;
}
.live-dot-ring {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  background: var(--primary);
  opacity: 0;
  animation: live-dot-ping 2.4s cubic-bezier(0, 0, 0.2, 1) infinite;
}
.live-dot-ring-2 { animation-delay: 1.2s; }

@keyframes live-dot-pop {
  from { transform: scale(0); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
@keyframes live-dot-ping {
  0%   { transform: scale(1); opacity: 0.55; }
  80%, 100% { transform: scale(3.4); opacity: 0; }
}
@keyframes live-dot-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}
@media (prefers-reduced-motion: reduce) {
  .live-dot, .live-dot-core, .live-dot-ring { animation: none !important; }
  .live-dot-ring { display: none; }
}
`;

export function AppLanding() {
  const [detected, setDetected] = useState<Device>("desktop");
  const [pick, setPick] = useState<Device>("desktop");
  const { dark, toggleTheme } = useTheme();

  useEffect(() => {
    const d = detectDevice();
    setDetected(d);
    setPick(d);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <style>{LIVE_DOT_CSS}</style>

      {/* Illustration panel — full height, only visible from lg */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#7ab558] via-primary to-[#22331c] lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-black/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute right-10 top-10 h-24 w-24 rounded-full bg-[#c8e896]/25 blur-2xl"
        />

        <div className="relative z-10 flex w-full flex-col items-center gap-10 px-10 xl:px-16">
          <div className="w-full max-w-[520px] xl:max-w-[620px]">
            <DevicesIllustration className="h-auto w-full drop-shadow-2xl" />
          </div>
          <div className="text-center text-white/90">
            <p className="text-lg font-semibold">One app, every device.</p>
            <p className="mt-1 text-sm text-white/60">{PLATFORM_TAGLINE}</p>
          </div>
        </div>
      </div>

      {/* Content panel — the only panel on mobile and tablet */}
      <div className="relative flex w-full flex-1 flex-col justify-center px-6 py-16 sm:px-10 lg:w-1/2 lg:px-14">
        {/* Theme toggle — pinned to the top-right corner, circular border */}
        <button
          onClick={toggleTheme}
          aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-accent/10 sm:right-6 sm:top-6"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>

        <div className="mx-auto flex w-full max-w-[440px] flex-col">
          <div className="flex items-center gap-2.5">
            <BrandLogo className="h-9 w-9 shrink-0" alt={PLATFORM_NAME} />
            <BrandName className="truncate text-lg font-bold tracking-tight" />
          </div>

          {/* Illustration — mobile/tablet only, fills the content width */}
          <div className="mx-auto mt-6 w-full max-w-[340px] lg:hidden">
            <DevicesIllustration className="h-auto w-full drop-shadow-xl" />
          </div>

          <h1 className="mt-5 text-center text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-left">
            Welcome to <BrandName />
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground lg:text-left">{PLATFORM_TAGLINE}</p>

          <div className="mt-4 flex flex-wrap justify-center gap-1.5 lg:justify-start">
            {[
              { icon: Users, label: "Labour tracking" },
              { icon: Truck, label: "Rentals" },
              { icon: Receipt, label: "Receipts" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground"
              >
                <Icon className="size-3 text-primary" />
                {label}
              </span>
            ))}
          </div>

          <Button
            asChild
            className="mt-6 h-12 w-full gap-2 rounded-full text-sm font-semibold shadow-md shadow-primary/20 transition-transform active:scale-[0.99]"
          >
            <Link to="/dashboard">
              <Home className="size-4" />
              Go to dashboard
            </Link>
          </Button>

          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border px-4 py-3 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-primary" />
            You'll be asked to sign in with your account.
          </div>

          {/* Get the app */}
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Get the app</p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {(
                [
                  { value: "android", label: "Android", icon: AndroidIcon },
                  { value: "ios", label: "iOS", icon: AppleIcon },
                  { value: "desktop", label: "Computer", icon: DesktopIcon },
                ] as const
              ).map(({ value, label, icon: Icon }) => {
                const active = pick === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPick(value)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-medium transition-all duration-200",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {detected === value && (
                      <span className="live-dot absolute right-2 top-2" aria-hidden="true">
                        <span className="live-dot-ring" />
                        <span className="live-dot-ring live-dot-ring-2" />
                        <span className="live-dot-core" />
                      </span>
                    )}
                    <Icon className="size-5" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-border p-4">
              {pick === "android" && (
                <>
                  <p className="text-sm font-medium">Phone &amp; tablet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Download the free APK and install it directly — no Play Store needed.
                  </p>
                  <Button asChild variant="outline" className="mt-3 w-full gap-2 rounded-full">
                    <a href={APK_URL} download>
                      <Download className="size-4" />
                      Download APK
                    </a>
                  </Button>
                </>
              )}
              {pick === "ios" && (
                <>
                  <p className="text-sm font-medium">iPhone &amp; iPad</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    There's no App Store app yet — use the dashboard in Safari, then add it to your Home
                    Screen for the full-screen app feel.
                  </p>
                  <Button asChild variant="outline" className="mt-3 w-full gap-2 rounded-full">
                    <Link to="/dashboard">
                      <Home className="size-4" />
                      Open in Safari
                    </Link>
                  </Button>
                </>
              )}
              {pick === "desktop" && (
                <>
                  <p className="text-sm font-medium">Windows, Mac &amp; Linux</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No install needed — use Chrome, Safari or Firefox for the best experience.
                  </p>
                  <Button asChild variant="outline" className="mt-3 w-full gap-2 rounded-full">
                    <Link to="/dashboard">
                      <Home className="size-4" />
                      Open the dashboard
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-muted-foreground/70 lg:text-left">
            Android app version {APP_VERSION} · {ANDROID_PACKAGE}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Devices illustration: laptop + tablet + phone on a dark forest panel.
 * Colours are the app's own dark-theme palette (forest green + lime), so it
 * looks the same in light and dark mode, like a "media" panel.
 */
function DevicesIllustration({ className }: { className?: string }) {
  const LIME = "#a8d977"; // --primary (dark theme)
  const LIME_SOFT = "#c8e896"; // --accent (dark theme)
  const MINT = "#7dcb92"; // --success (dark theme)
  const INK = "#0e1911"; // --background (dark theme)
  const line = "rgba(168, 217, 119, 0.3)";

  return (
    <svg
      viewBox="0 0 548 357"
      role="img"
      aria-label={`${PLATFORM_NAME} on laptop, tablet and phone`}
      className={className}
    >
      <defs>
        <linearGradient id="dev-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#12211a" />
          <stop offset="1" stopColor="#0a130d" />
        </linearGradient>
        <linearGradient id="dev-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LIME} stopOpacity="0.24" />
          <stop offset="1" stopColor={LIME} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="dev-orb" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={LIME_SOFT} />
          <stop offset="1" stopColor={MINT} />
        </linearGradient>
        <filter id="dev-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>

      {/* Panel */}
      <rect
        x="0.75"
        y="0.75"
        width="546.5"
        height="355.5"
        rx="24"
        fill="url(#dev-panel)"
        stroke={line}
        strokeWidth="1.5"
      />

      {/* Soft background glow */}
      <ellipse cx="275" cy="168" rx="214" ry="108" fill={LIME} opacity="0.06" />

      {/* Laptop base */}
      <path
        d="M133 246 H373 L388 278 Q388 280 386 280 H140 Q134 280 134 274 Z"
        fill="#0f1c13"
        stroke={line}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Laptop lid */}
      <rect x="114" y="92" width="240" height="154" rx="14" fill="#0f1c13" stroke={line} strokeWidth="2.5" />
      <rect x="132" y="110" width="205" height="118" rx="6" fill="url(#dev-screen)" />

      {/* Glowing centre badge with shield-check */}
      <circle cx="234" cy="169" r="31" fill={LIME} opacity="0.55" filter="url(#dev-glow)" />
      <circle cx="234" cy="169" r="31" fill="url(#dev-orb)" />
      <g
        transform="translate(219 154) scale(1.25)"
        fill="none"
        stroke={INK}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        <path d="m9 12 2 2 4-4" />
      </g>

      {/* Tablet (tilted) */}
      <g transform="rotate(-6 98 236)">
        <rect x="51" y="175" width="94" height="122" rx="13" fill="#0f1c13" stroke={line} strokeWidth="2.5" />
        <rect x="64" y="188" width="68" height="96" rx="5" fill="url(#dev-screen)" />
        <g
          transform="translate(74 214) scale(2)"
          fill="none"
          stroke={LIME}
          strokeOpacity="0.5"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </g>
      </g>

      {/* Phone */}
      <rect x="383" y="143" width="85" height="143" rx="15" fill="#0f1c13" stroke={line} strokeWidth="2.5" />
      <rect x="394" y="160" width="64" height="102" rx="5" fill="url(#dev-screen)" />
      <circle cx="425.5" cy="274" r="5" fill={line} />
      <g
        transform="translate(413 192) scale(1.05)"
        fill="none"
        stroke={LIME_SOFT}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </g>
    </svg>
  );
}