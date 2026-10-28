/**
 * Indian Rupee Number-to-Words Formatter
 * Converts numeric amounts to authoritative Indian currency text.
 * e.g. 145800 -> "Rupees One Lakh Forty-Five Thousand Eight Hundred Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertBelowThousand(n: number): string {
  let str = "";
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + " Hundred ";
    n %= 100;
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)] + (n % 10 !== 0 ? "-" + ONES[n % 10] : "") + " ";
  } else if (n > 0) {
    str += ONES[n] + " ";
  }
  return str.trim();
}

function integerToIndianWords(num: number): string {
  const crores = Math.floor(num / 10000000);
  let remainder = num % 10000000;

  const lakhs = Math.floor(remainder / 100000);
  remainder %= 100000;

  const thousands = Math.floor(remainder / 1000);
  remainder %= 1000;

  let result = "";

  // Above 999 crore the crore count itself is spelled in the Indian system ("One Thousand Crore").
  if (crores > 0) {
    result += integerToIndianWords(crores) + " Crore ";
  }
  if (lakhs > 0) {
    result += convertBelowThousand(lakhs) + " Lakh ";
  }
  if (thousands > 0) {
    result += convertBelowThousand(thousands) + " Thousand ";
  }
  if (remainder > 0) {
    result += convertBelowThousand(remainder) + " ";
  }

  return result.trim();
}

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Rupees Zero Only";

  // Work in whole paise so 0.29 or 1.10 don't lose a paisa to float error.
  const totalPaise = Math.round(Math.abs(amount) * 100);
  const rupees = integerToIndianWords(Math.floor(totalPaise / 100));
  const paise = totalPaise % 100;

  if (!rupees && !paise) return "Rupees Zero Only";
  const paiseText = paise > 0 ? `${convertBelowThousand(paise)} Paise` : "";
  if (!rupees) return `${paiseText} Only`;
  return `Rupees ${rupees}${paiseText ? ` and ${paiseText}` : ""} Only`;
}
