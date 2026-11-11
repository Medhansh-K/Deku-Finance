import React from "react";
import { Input } from "@/components/ui/Input";

export function ReportDateRange({
  from,
  to,
  onFrom,
  onTo,
  problem,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  problem?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-36">
        <Input label="From" type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div className="w-36">
        <Input label="To" type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
      {problem && (
        <p role="alert" className="basis-full text-[12.5px] font-medium text-bad">
          {problem}
        </p>
      )}
    </div>
  );
}
