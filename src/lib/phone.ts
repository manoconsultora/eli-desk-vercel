import { parsePhoneNumberFromString } from "libphonenumber-js";

// Same rule as ELI Join: the database only accepts E.164 (+5491158749895). Without a country
// code it is read as Argentina, and an Argentine mobile gets the 9 after 54 when it is missing,
// because "11 5874-9895" reads like a landline. Foreign numbers are kept as they come.
export function normalizePhone(phone: string): string | null {
  const parsed = parsePhoneNumberFromString(phone, "AR");
  if (!parsed?.isValid()) return null;
  if (parsed.country === "AR" && !parsed.number.startsWith("+549")) return `+549${parsed.nationalNumber}`;
  return parsed.number;
}

// For display: +54 9 11 5874 9895. Numbers saved before the rule are shown as they were saved.
export function formatPhone(phone: string): string {
  if (!phone.startsWith("+")) return phone;
  return parsePhoneNumberFromString(phone)?.formatInternational() ?? phone;
}
