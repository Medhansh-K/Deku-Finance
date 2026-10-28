import { it, expect } from "vitest";
import { currentFinancialYear } from "@/components/navigation/AppSidebar";

it("rolls the Indian financial year over on 1 April", () => {
  expect(currentFinancialYear(new Date(2027, 2, 31))).toBe("2026-27");
  expect(currentFinancialYear(new Date(2027, 3, 1))).toBe("2027-28");
  expect(currentFinancialYear(new Date(2099, 11, 1))).toBe("2099-00");
});
