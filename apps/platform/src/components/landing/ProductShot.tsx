import Image, { type StaticImageData } from "next/image";

/** A real screenshot or autoplay demo video in a quiet window frame. `chrome={false}` for crops of a floating panel. */
export default function ProductShot({
  src,
  videoSrc,
  poster,
  alt,
  priority = false,
  chrome = true,
  className = "",
  sizes = "(min-width: 1240px) 1200px, 100vw",
}: {
  src?: StaticImageData;
  videoSrc?: string;
  poster?: string;
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
      {videoSrc ? (
        <video
          src={videoSrc}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-label={alt}
          className="block h-auto w-full bg-surface"
        />
      ) : src ? (
        /* Already sized and compressed WebP; skipping the optimiser keeps the standalone server free of sharp. */
        <Image src={src} alt={alt} priority={priority} unoptimized sizes={sizes} className="block h-auto w-full" />
      ) : null}
    </figure>
  );
}
