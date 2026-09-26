"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  /** "destructive" styles the confirm button red, for things like deleting or clearing data. */
  variant?: "default" | "destructive";
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

let showRequest: ((request: ConfirmRequest) => void) | null = null;

/**
 * Branded, promise-based replacement for `window.confirm` — same call shape
 * (`await confirm("Are you sure?")`), but renders as the app's own styled
 * dialog instead of the browser's native "<site> says" popup.
 *
 * Usable from anywhere: event handlers, mutation callbacks, plain helper
 * functions. Requires <ConfirmDialogHost /> to be mounted once near the app
 * root (see routes/__root.tsx) — every call anywhere in the app shares it.
 */
export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === "string" ? { description: options } : options;

  return new Promise((resolve) => {
    if (!showRequest) {
      console.warn("ConfirmDialogHost is not mounted — falling back to window.confirm");
      resolve(window.confirm(opts.description));
      return;
    }
    showRequest({ ...opts, resolve });
  });
}

/** Mount once, near the app root, alongside <Toaster />. */
export function ConfirmDialogHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    showRequest = (req) => setRequest(req);
    return () => {
      showRequest = null;
    };
  }, []);

  const close = (result: boolean) => {
    request?.resolve(result);
    setRequest(null);
  };

  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && close(false)}>
      <DialogContent className="max-w-[420px] rounded-[1.5rem] sm:p-7">
        <DialogHeader>
          <DialogTitle>{request?.title ?? "Are you sure?"}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full font-semibold"
            onClick={() => close(false)}
          >
            {request?.cancelText ?? "Cancel"}
          </Button>

          <Button
            type="button"
            variant={request?.variant === "destructive" ? "destructive" : "default"}
            className="h-11 rounded-full font-semibold"
            onClick={() => close(true)}
          >
            {request?.confirmText ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}