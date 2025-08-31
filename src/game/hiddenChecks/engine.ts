
import type { Character } from '../state/types'
import { masteryBonus, effectiveLevel } from '../state/rules'
import checks from '../data/dw_data/CHECKS/hidden_by_skill.json'

export type HiddenCheck = { skill:string; title:string; context:'Бой'|'Сюжет'|'Социальное'|'Исследование'; dc:{type:'relative'|'rank', base:number, offset?:number}; textSuccess:string }
export type HiddenCheckResult = { title:string, textHighlighted:string }

export async function runHiddenChecks(mode:'Бой'|'Сюжет', char: Character): Promise<HiddenCheckResult[]> {
  const data: HiddenCheck[] = (checks as any).items || []
  if(!data.length) return []
  const pool = data.filter(x=> (mode==='Бой' ? x.context==='Бой' : x.context!=='Бой'))
  if(!pool.length) return []
  const take = Math.min(2, pool.length)
  const out: HiddenCheckResult[] = []
  for(let i=0;i<take;i++){
    const h = pool[(Math.random()*pool.length)|0]
    const d20 = 1 + Math.floor(Math.random()*20)
    const lvl = (char.skills && (h.skill in (char.skills as any))) ? effectiveLevel(char, h.skill as any) : 0
    const bonus = masteryBonus(lvl)
    const luck = Math.min(char.luck, Math.max(0, 20 - d20))
    const fatigue = Math.min(20, char.fatigue)
    const dc = (h.dc?.base ?? 14) + (h.dc?.offset ?? 0)
    const base = d20 + luck
    const total = base + bonus - fatigue
    const success = (d20===20) || (d20!==1 && total>=dc)
    if(success){
      out.push({ title: h.title, textHighlighted: h.textSuccess.replace(/\*\*(.+?)\*\*/g,'==$1==') })
    }
  }
  return out
}
