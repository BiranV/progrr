export function extractYouTubeVideoId(url: string): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;

  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id ? id : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com"
    ) {
      // /watch?v=<id>
      const v = u.searchParams.get("v");
      if (v) return v;

      // /shorts/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      const shortsIndex = parts.indexOf("shorts");
      if (shortsIndex >= 0 && parts[shortsIndex + 1])
        return parts[shortsIndex + 1];

      // /embed/<id>
      const embedIndex = parts.indexOf("embed");
      if (embedIndex >= 0 && parts[embedIndex + 1])
        return parts[embedIndex + 1];
    }
  } catch {
    // not a URL
  }

  // Fallback: accept a bare ID-ish string
  const idLike = raw.match(/^[a-zA-Z0-9_-]{8,}$/)?.[0];
  return idLike || null;
}

export function toYouTubeEmbedUrl(urlOrId: string): string | null {
  const id = extractYouTubeVideoId(urlOrId);
  if (!id) return null;
  // Use nocookie variant.
  return `https://www.youtube-nocookie.com/embed/${id}`;
}
