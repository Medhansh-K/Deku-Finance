import React from "react";
import { FlaskConical } from "lucide-react";

/** Shown wherever a sandbox provider's output appears: nothing it returns is real. */
export function SandboxBanner({ what }: { what: string }) {
  return (
    <div role="note" className="flex items-start gap-2 rounded-ctl bg-warn-wash px-4 py-3 text-[13px] text-warn">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Sandbox, not legally valid.</span> The {what} provider on this server is a local demo.
        Nothing is sent to the GST portal or any registry, and everything it returns is marked SANDBOX.
      </p>
    </div>
  );
}
