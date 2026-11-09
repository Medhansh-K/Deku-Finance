/** Codes printed on invoices are 4, 6 or 8 digits (2-digit chapters exist in the master but aren't valid on a line). */
export function hsnCodeError(raw: string): string | null {
  const v = raw.trim();
  if (!v || /^(\d{4}|\d{6}|\d{8})$/.test(v)) return null;
  return "HSN/SAC must be 4, 6 or 8 digits.";
}

export interface ComboState {
  open: boolean;
  active: number; // -1 = no option highlighted
}

/** Keyboard behaviour of the combobox. `handled` false means let the key through (e.g. Enter to the form). */
export function comboboxKey(
  key: string,
  state: ComboState,
  count: number,
): ComboState & { handled: boolean; select: boolean } {
  const { open, active } = state;
  switch (key) {
    case "ArrowDown":
      if (!open) return { open: true, active: count > 0 ? 0 : -1, handled: true, select: false };
      return { open, active: count > 0 ? (active + 1) % count : -1, handled: true, select: false };
    case "ArrowUp":
      if (!open) return { open: true, active: count > 0 ? count - 1 : -1, handled: true, select: false };
      return { open, active: count > 0 ? (active <= 0 ? count - 1 : active - 1) : -1, handled: true, select: false };
    case "Enter":
      if (open && active >= 0 && active < count) return { open: false, active: -1, handled: true, select: true };
      return { ...state, handled: false, select: false };
    case "Escape":
      if (open) return { open: false, active: -1, handled: true, select: false };
      return { ...state, handled: false, select: false };
    default:
      return { ...state, handled: false, select: false };
  }
}
