import { useEffect, useMemo, useState } from "react";
import { getDefaultServiceImageSrc } from "../utils/defaultImages";

export function useDefaultServiceImageSrc() {
  const get = () => getDefaultServiceImageSrc();
  const [src, setSrc] = useState<string>(() => get());

  useEffect(() => {
    // Watch for theme class changes on <html>.
    const el = document.documentElement;
    const observer = new MutationObserver(() => setSrc(get()));
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  }, []);

  return src;
}

export function useServiceImageSrc(imageSrc?: string | null) {
  const fallback = useDefaultServiceImageSrc();
  return useMemo(() => {
    if (typeof imageSrc !== "string") return fallback;
    const trimmed = imageSrc.trim();
    return trimmed ? trimmed : fallback;
  }, [imageSrc, fallback]);
}


