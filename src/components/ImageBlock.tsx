import { buildPollinationsURL, ImageKind } from "@utils/images"

export function ImageBlock({ kind, prompt }:{ kind: ImageKind, prompt: string }){
  const url = buildPollinationsURL(kind, prompt)
  return (
    <div className="w-full rounded-xl2 overflow-hidden border border-iron mb-3" style={{ clipPath: "inset(0 0 8% 0)" }}>
      <img src={url} alt={prompt} className="w-full block" loading="lazy"/>
    </div>
  )
}
