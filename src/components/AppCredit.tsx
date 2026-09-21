import logo from "@/assets/logo.png";
import { BrandLogo } from "@/components/BrandLogo";
import { cn } from "@/lib/utils";
import { PLATFORM_NAME } from "@/lib/brand";

/**
 * "By <logo> LedGro" — the small app credit shown under the Sign out button.
 *
 * The logo is passed in explicitly (`src={logo}`) so it is always the LedGro
 * app logo, never the signed-in business's logo that BrandLogo would
 * otherwise default to.
 */
export function AppCredit({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1.5 pt-1 text-[11px] text-muted-foreground",
        className,
      )}
    >
      <span>By</span>
      <BrandLogo src={logo} alt="" animated={false} ringWidth={1} className="h-4 w-4" />
      <span className="font-bold tracking-tight text-foreground">{PLATFORM_NAME}</span>
    </div>
  );
}