export type Rank = "weak"|"medium"|"strong"|"boss"
export type Archetype = "tank"|"avalanche"|"trickster"|"horde"|"ambusher"|"default"
export type Distance = "melee"|"near"|"far"|"very_far"
export type StatusType = "stun"|"knockout"|"disarm"|"bleed"|"burn"|"freeze"|"poison"
export interface Status { id:string; type:StatusType; source:string; duration_left:number; stacks:false; intensity?:number }
export interface SkillBlock { [id:string]: number }
export interface Hero {
  name:string; race:string; gender:"male"|"female"|"other"; age?:number; bank:number;
  skills: SkillBlock; caps:{[id:string]:number}; pb:number;
  hp_max:number; hp:number; fatigue:number; luck:number;
  armorId: "clothes"|"light"|"medium"|"heavy"; shieldId?: "light"|"medium"|"heavy";
  weaponMain?:string; weaponOff?:string; weakness?: "brute"|"frail"; perks:{ master?:string, specialist?:string }
}
export interface Enemy {
  id:string; name:string; rank:Rank; archetype:Archetype;
  attackDC:number; defenseDC:number; state:"healthy"|"light"|"heavy"|"near_death"|"dead"|"unhurt"; tags?:string[]
}
export interface Message { id:string; role:"player"|"dm"|"system"; text:string; to_ui?:any[]; meta?:any }
