import React from "react";

export function GatewayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#F8FAFC] dark:bg-[#101820] transition-colors duration-200">
      {children}
    </div>
  );
}
