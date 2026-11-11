import React from "react";
import Image from "next/image";

/** A real app screenshot in a quiet browser-window frame. */
export function Shot({
  src,
  alt,
  width,
  height,
  sizes = "(min-width: 1200px) 1136px, 100vw",
  className = "",
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  className?: string;
}) {
  return (
    <figure className={`overflow-hidden rounded-panel border border-line bg-surface shadow-pop ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-line px-4" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
      </div>
      <Image src={src} alt={alt} width={width} height={height} sizes={sizes} className="h-auto w-full" />
    </figure>
  );
}

/** A screenshot cropped to a fixed frame from its top-left corner, for card thumbnails. */
export function Thumb({ src, alt, ratio = "aspect-[16/10]" }: { src: string; alt: string; ratio?: string }) {
  return (
    <div className={`relative ${ratio} overflow-hidden rounded-[10px] border border-line bg-canvas`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(min-width: 1024px) 560px, 100vw"
        className="object-cover object-left-top transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
      />
    </div>
  );
}
