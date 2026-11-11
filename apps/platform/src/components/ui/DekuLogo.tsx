import React from "react";

interface DekuLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  className?: string;
  maskColor?: string;
  eyeColor?: string;
}

export function DekuLogo({
  size = 28,
  className = "",
  maskColor = "#05B8A5",
  eyeColor = "#04181A",
  ...props
}: DekuLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Deku Finance Logo"
      {...props}
    >
      <path
        d="M64 2c-11.9 0-20.1 4.9-27.4 9.5C29.8 14.8 24.7 17.6 16 17.6 7.2 17.6 0 24.8 0 33.6v13.6C0 84 28.7 118 64 118s64-34 64-70.8V33.6c0-8.8-7.2-16-16-16-8.7 0-13.8-2.8-20.6-6.1C84 6.9 75.8 2 64 2Z"
        fill={maskColor}
      />
      <ellipse cx="44.5" cy="55" rx="9" ry="13" fill={eyeColor} />
      <ellipse cx="83.5" cy="55" rx="9" ry="13" fill={eyeColor} />
    </svg>
  );
}

export default DekuLogo;

