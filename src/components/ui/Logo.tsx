import Image from "next/image";
import { cn } from "@/lib/utils";

// Intrinsic size of public/logo.png, cropped to the wordmark itself.
const LOGO_W = 348;
const LOGO_H = 124;

/**
 * The official TEDxNIFT Jodhpur wordmark.
 *
 * Size it by height (e.g. `className="h-10 w-auto"`) and the width follows
 * the real aspect ratio. The mark is never recoloured, cropped or
 * distorted, per TEDx brand rules — the "NIFT Jodhpur" line is black, so
 * over dark backgrounds use `LogoPlate` rather than inverting it.
 */
export function Logo({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="TEDxNIFT Jodhpur"
      width={LOGO_W}
      height={LOGO_H}
      priority={priority}
      className={cn("object-contain", className)}
    />
  );
}

/** Logo on its own white plate — for use over dark or tinted backgrounds. */
export function LogoPlate({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-white px-6 py-4",
        className
      )}
    >
      <Logo priority className="h-10 w-auto" />
    </div>
  );
}
