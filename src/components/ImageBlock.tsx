import { useMemo, useRef, useState } from "react"
import { buildPollinationsURLStable, ImageKind } from "@utils/images"
import "../styles.skel.css"

export function ImageBlock({ kind, prompt }:{ kind: ImageKind, prompt: string }){
  // Stable salt for this image instance
  const saltRef = useRef<string>(`${Date.now().toString(36)}-${Math.abs(hashCode(prompt)).toString(36)}`)
  // compute URL once per (kind,prompt)
  const url = useMemo(()=> buildPollinationsURLStable(kind, prompt, saltRef.current), [kind, prompt])

  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <div className="w-full rounded-xl2 overflow-hidden border border-iron mb-3 relative" style={{ clipPath: "inset(0 0 8% 0)" }}>
      {!loaded && !errored && <div className="skel" style={{height: 220}}/>}
      {!errored ? (
        <img
          src={url}
          alt=""
          className={"w-full block transition-opacity duration-300 " + (loaded ? "opacity-100" : "opacity-0")}
          loading="lazy"
          onLoad={()=> setLoaded(true)}
          onError={()=> setErrored(true)}
        />
      ) : (
        <div className="text-xs text-ash/70 p-2">Картинка не загрузилась</div>
      )}
    </div>
  )
}

// Tiny string hash to vary salt; not cryptographic.
function hashCode(str:string){
  let h = 0
  for (let i=0;i<str.length;i++){
    h = ((h<<5)-h) + str.charCodeAt(i)
    h |= 0
  }
  return h
}
