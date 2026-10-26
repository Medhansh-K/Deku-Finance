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

export function numberToIndianWords(amount: number): string {
  if (isNaN(amount) || amount === 0) return "Rupees Zero Only";

  const num = Math.floor(Math.abs(amount));
  const paise = Math.round((Math.abs(amount) - num) * 100);

  let crores = Math.floor(num / 10000000);
  let remainder = num % 10000000;

  let lakhs = Math.floor(remainder / 100000);
  remainder %= 100000;

  let thousands = Math.floor(remainder / 1000);
  remainder %= 1000;

  let hundreds = remainder;

  let result = "";

  if (crores > 0) {
    result += convertBelowThousand(crores) + " Crore ";
  }
  if (lakhs > 0) {
    result += convertBelowThousand(lakhs) + " Lakh ";
  }
  if (thousands > 0) {
    result += convertBelowThousand(thousands) + " Thousand ";
  }
  if (hundreds > 0) {
    result += convertBelowThousand(hundreds) + " ";
  }

  result = result.trim();
  let fullText = result ? `Rupees ${result}` : "Rupees";

  if (paise > 0) {
    fullText += ` and ${convertBelowThousand(paise)} Paise`;
  }

  return `${fullText} Only`;
}
