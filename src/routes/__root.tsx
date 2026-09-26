import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_NAME, PLATFORM_TAGLINE } from "@/lib/brand";
import { syncNativeStatusBar } from "@/lib/native-status-bar";

import appCss from "../styles.css?url";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "theme-color", content: "#f3f6ee" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: PLATFORM_NAME },
      { name: "description", content: PLATFORM_TAGLINE },
      { name: "google-site-verification", content: "google2ae77d07cfbf23ca.html" },
      { property: "og:title", content: PLATFORM_NAME },
      { property: "og:description", content: PLATFORM_TAGLINE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/logo.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});

// Runs synchronously in <head>, before anything paints, so the status bar
// color is correct on the very first frame instead of flashing/mismatching.
// Keep the hex values below in sync with `--background` in styles.css.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("mbs-theme");
    var isDark = stored === "dark";
    if (isDark) {
      document.documentElement.classList.add("dark");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", isDark ? "#0e1911" : "#f3f6ee");
    }
  } catch (e) {}
})();
`;

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Live updates, app-wide: whenever a row changes in the database
  // (from this tab, another tab, another device, or another user),
  // the matching cached query is invalidated so React Query refetches
  // it and every screen showing that data updates on its own —
  // no manual refresh needed anywhere in the app.
  //
  // This only works once the tables below are added to Supabase's
  // `supabase_realtime` publication (see the
  // `20260902000000_enable_realtime_tables.sql` migration).
  useEffect(() => {
    const channel = supabase.channel("app-live-updates");

    const invalidate = (...keys: unknown[][]) => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key });
    };

    const rowWorkerId = (payload: { new: unknown; old: unknown }) =>
      (payload.new as { worker_id?: string } | null)?.worker_id ??
      (payload.old as { worker_id?: string } | null)?.worker_id;

    // rentals (rentals list, dashboard, reports, receipts list & detail)
    channel.on("postgres_changes", { event: "*", schema: "public", table: "rentals" }, () => {
      invalidate(["rentals"], ["rental"], ["rental-group"]);
    });

    // workers (labour list, manage workers, rentals' worker dropdown)
    channel.on("postgres_changes", { event: "*", schema: "public", table: "workers" }, () => {
      invalidate(["workers"]);
    });

    // attendance (labour calendar + per-worker attendance)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_attendance" },
      (payload) => {
        invalidate(["worker_attendance"], ["all_attendance"]);
        const workerId = rowWorkerId(payload);
        if (workerId) invalidate(["worker_attendance", workerId]);
      },
    );

    // worker payments (per-worker payment history)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_payments" },
      (payload) => {
        const workerId = rowWorkerId(payload);
        if (workerId) invalidate(["worker_payments", workerId]);
      },
    );

    // worker feedback (per-worker feedback + admin feedback inbox)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_feedback" },
      (payload) => {
        invalidate(["worker_feedback_admin"]);
        const workerId = rowWorkerId(payload);
        if (workerId) invalidate(["worker_feedback", workerId]);
      },
    );

    // worker live locations (admin locations map)
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "worker_locations" },
      () => {
        invalidate(["worker-locations-admin"]);
      },
    );

    // diary notes
    channel.on("postgres_changes", { event: "*", schema: "public", table: "diary_notes" }, () => {
      invalidate(["diary_notes"]);
    });

    // platform admin console (businesses, per-business user counts, users)
    channel.on("postgres_changes", { event: "*", schema: "public", table: "businesses" }, () => {
      invalidate(["platform"]);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
      invalidate(["platform"], ["workers"]);
    });
    channel.on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
      invalidate(["platform"], ["workers"]);
    });
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "platform_admins" },
      () => {
        invalidate(["platform"]);
      },
    );

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // In the native LedGro app, keep the status-bar strip the same colour as the header.
  // Watches the <html class="dark"> flag, so it follows the theme toggle automatically.
  // Does nothing in a normal browser.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => syncNativeStatusBar(root.classList.contains("dark"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch((error) => {
          console.warn("Offline app support is unavailable", error);
        });
    }
  }, []);
  useEffect(() => {
    const recoveryKey = "mbs-dynamic-import-recovery";
    const isDynamicImportFailure = (message: string) =>
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Importing a module script failed");
    const reloadOnce = (message: string) => {
      if (!isDynamicImportFailure(message)) return;
      try {
        if (sessionStorage.getItem(recoveryKey) === "1") {
          sessionStorage.removeItem(recoveryKey);
          return;
        }
        sessionStorage.setItem(recoveryKey, "1");
      } catch {
        return;
      }
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker?.getRegistrations();
          await Promise.all(registrations?.map((registration) => registration.unregister()) ?? []);
          const cacheNames = await caches?.keys();
          await Promise.all(cacheNames?.map((name) => caches.delete(name)) ?? []);
        } catch {
          // Continue with a cache-busting navigation if storage APIs are unavailable.
        }
        const url = new URL(window.location.href);
        url.searchParams.set("asset_refresh", String(Date.now()));
        window.location.replace(url.toString());
      })();
    };
    const onError = (event: ErrorEvent) => reloadOnce(event.message || event.error?.message || "");
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reloadOnce(typeof reason === "string" ? reason : (reason?.message ?? ""));
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
      <ConfirmDialogHost />
    </QueryClientProvider>
  );
}