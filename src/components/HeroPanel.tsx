import { useGameStore } from "@store/game"

export function HeroPanel(){
  const hero = useGameStore(s=>s.hero)
  return (
    <div className="h-full bg-coal/60 rounded-xl2 p-4 space-y-3 border border-iron">
      <div className="text-xl font-semibold">Персонаж</div>
      <div className="text-sm text-ash">{hero.name} — {hero.race}, {hero.gender}</div>
      <div className="space-y-2">
        <Stat label="HP" value={`${hero.hp}/${hero.hp_max}`} />
        <Stat label="Усталость" value={hero.fatigue} />
        <Stat label="Удача" value={hero.luck} />
        <Stat label="PB" value={hero.pb} />
      </div>
      <div className="pt-3 text-sm text-ash">Броня: <b>{hero.armorId}</b>, Щит: <b>{hero.shieldId || "—"}</b></div>
    </div>
  )
}
function Stat({label, value}:{label:string, value:any}){
  return <div className="flex items-center justify-between bg-iron/60 rounded-lg px-3 py-2">
    <div className="text-sm text-ash">{label}</div><div className="text-base">{value}</div>
  </div>
}
