import Image, { type StaticImageData } from "next/image";

/** A real screenshot of the app in a quiet window frame. `chrome={false}` for crops of a floating panel. */
export default function ProductShot({
  src,
  alt,
  priority = false,
  chrome = true,
  className = "",
  sizes = "(min-width: 1240px) 1200px, 100vw",
}: {
  src: StaticImageData;
  alt: string;
  priority?: boolean;
  chrome?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <figure className={`overflow-hidden rounded-panel border border-line bg-surface shadow-pop ${className}`}>
      {chrome && (
        <div aria-hidden="true" className="flex h-9 items-center gap-1.5 border-b border-line bg-[#fafbfa] px-4">
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
        </div>
      )}
      {/* Already sized and compressed WebP; skipping the optimiser keeps the standalone server free of sharp. */}
      <Image src={src} alt={alt} priority={priority} unoptimized sizes={sizes} className="block h-auto w-full" />
    </figure>
  );
}
