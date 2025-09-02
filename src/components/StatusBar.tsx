import { useGameStore } from "@store/game"
export function StatusBar(){
  const statuses = useGameStore(s=>s.statuses)
  if (!statuses.length) return null
  return (
    <div className="w-full bg-coal/60 rounded-xl2 p-2 border border-iron flex gap-2 mb-3">
      {statuses.map(st => (
        <div key={st.id} className="px-3 py-1 bg-iron/70 rounded-md text-sm">{st.type} • {st.duration_left}</div>
      ))}
    </div>
  )
}
