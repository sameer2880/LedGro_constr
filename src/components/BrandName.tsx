import { cn } from "@/lib/utils";
import { PLATFORM_NAME, PLATFORM_NAME_PARTS } from "@/lib/brand";

/**
 * The "Plinthora" title, two-toned: "Plinth" in black and "ora" in the app's
 * theme green (`--primary`, so it also follows the light / dark theme).
 *
 * Use this instead of printing `PLATFORM_NAME` wherever the name is shown as a
 * visible title. (Browser-tab titles and other plain-text places can't carry
 * colour, so they keep using `PLATFORM_NAME`.)
 *
 * `onDark` is for placing it on the green illustration panel of the sign-in
 * screen, where black + green would vanish: it uses white + light lime instead.
 */
export function BrandName({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  const [first, second] = PLATFORM_NAME_PARTS;
  return (
    <span className={cn("whitespace-nowrap", className)} aria-label={PLATFORM_NAME}>
      <span aria-hidden className={onDark ? "text-white" : "text-neutral-950 dark:text-white"}>
        {first}
      </span>
      <span aria-hidden className={onDark ? "text-[#c8e896]" : "text-primary"}>
        {second}
      </span>
    </span>
  );
}