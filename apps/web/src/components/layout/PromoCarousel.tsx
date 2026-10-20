"use client";

import { useEffect, useState } from "react";

interface Banner {
  id: string;
  imageUrl: string;
  title: string | null;
  subtitle: string | null;
  linkUrl: string | null;
}

const AUTO_ROTATE_MS = 6000;

export function PromoCarousel({ banners }: { banners: Banner[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setActive((i) => (i + 1) % banners.length), AUTO_ROTATE_MS);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[active];

  const content = (
    <div
      className="relative w-full aspect-[21/9] sm:aspect-[3/1] rounded-2xl overflow-hidden bg-bg-card border border-bg-border bg-cover bg-center"
      style={{ backgroundImage: `url(${banner.imageUrl})` }}
    >
      {(banner.title || banner.subtitle) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent flex flex-col justify-end p-4 sm:p-6">
          {banner.title && <p className="text-lg sm:text-2xl font-black text-white leading-tight">{banner.title}</p>}
          {banner.subtitle && <p className="text-xs sm:text-sm text-white/80 mt-1">{banner.subtitle}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative">
      {banner.linkUrl ? (
        <a href={banner.linkUrl} target={banner.linkUrl.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
          {content}
        </a>
      ) : content}

      {banners.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              onClick={() => setActive(i)}
              aria-label={`Bannière ${i + 1}`}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-green-500" : "w-1.5 bg-bg-border"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
