"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { DekuConsultantView } from "@/modules/consultant/DekuConsultantView";

export default function DekuConsultantPage() {
  return (
    <AppShell>
      <div className="w-full h-full overflow-hidden flex flex-col flex-1 bg-[#F8FAFC] text-slate-900">
        <DekuConsultantView />
      </div>
    </AppShell>
  );
}
