/** The one place the selected company (a per-browser choice) is written. AuthContext and the shell follow the event. */
export function setActiveOrg(org: { id: string; name: string }) {
  localStorage.setItem("deku_active_org_id", org.id);
  localStorage.setItem("deku_active_org_name", org.name);
  window.dispatchEvent(new Event("deku_active_org_changed"));
}

/** Session over: the next person on this browser must not see this company's name. */
export function clearActiveOrg() {
  for (const key of ["deku_active_org", "deku_active_org_id", "deku_active_org_name", "deku_operating_mode"]) {
    localStorage.removeItem(key);
  }
}
