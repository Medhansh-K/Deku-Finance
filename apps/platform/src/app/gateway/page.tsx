"use client";

import React from "react";
import { AppShell } from "@/layouts/AppShell";
import { GatewayLayout } from "@/layouts/GatewayLayout";
import { GatewayLanding } from "@/modules/gateway/GatewayLanding";

export default function GatewayPage() {
  return (
    <AppShell>
      <GatewayLayout>
        <GatewayLanding />
      </GatewayLayout>
    </AppShell>
  );
}
