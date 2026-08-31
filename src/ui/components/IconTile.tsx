import { useState } from "react";

interface IconTileProps {
  // Local icon URL from the payload; undefined when the Refresh has no file
  // for this entity (download failed, upstream placeholder, or pre-icon data).
  src?: string;
  label: string;
}

// The one way an icon renders anywhere in the app. Missing references and
// files that fail to load both collapse to the neutral fallback tile, so a
// bad asset costs one letter tile, never a broken image or a dead card.
export function IconTile({ src, label }: IconTileProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <span className="icon-fallback" aria-hidden="true">
        {label.charAt(0)}
      </span>
    );
  }
  return (
    <img className="icon-img" src={src} alt="" onError={() => setFailedSrc(src)} />
  );
}
