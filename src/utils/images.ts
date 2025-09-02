export type ImageKind = "scene"|"creature"|"character"|"art"

const PREFIX: Record<ImageKind, string> = {
  scene: "Create a Pixel art Dark fantasy scene. cinematic composition. no characters. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Scene:",
  creature: "Create a Pixel art Dark fantasy creature. cinematic composition. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Creature:",
  character: "Create a Pixel art Dark fantasy Character. cinematic composition. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Character:",
  art: "Create a Pixel art Dark fantasy art. cinematic composition. muted dark palette with bold highlights, Epic scale, haunting, surreal, inspired by dark fantasy painters and modern grimdark art 8 bit. Art:"
}

/** Unstable variant (kept for backward-compat) */
export function buildPollinationsURL(kind: ImageKind, promptEN: string){
  const t = new Date().toISOString()
  const full = `${PREFIX[kind]} ${promptEN} | t=${t}`
  const encoded = encodeURIComponent(full)
  return `https://image.pollinations.ai/prompt/${encoded}`
}

/** Stable variant: caller provides a fixed salt to avoid URL changes on re-renders */
export function buildPollinationsURLStable(kind: ImageKind, promptEN: string, salt: string){
  const full = `${PREFIX[kind]} ${promptEN} | t=${salt}`
  const encoded = encodeURIComponent(full)
  return `https://image.pollinations.ai/prompt/${encoded}`
}
