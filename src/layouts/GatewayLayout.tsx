import React from "react";

export function GatewayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F8FAFC]">
      {children}
    </div>
  );
}
