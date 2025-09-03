export type Role = 'player' | 'dm' | 'system' | 'image'

export interface ChatMessage {
  id: string
  role: Role
  text?: string
  url?: string // for images
}

export type PendingPhase = 'thinking' | 'typing' | null

export interface ToUICommand {
  cmd: 'set_scene' | 'show_image' | 'show_creature'
  payload: Record<string, any>
}
