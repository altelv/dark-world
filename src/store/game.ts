import { create } from 'zustand'
import { nanoid } from './nanoid'
import type { ChatMessage, PendingPhase, ToUICommand } from '@types/index'
import { postChat } from '@lib/api'
import { sanitizeIntro } from '@lib/sanitize'

export interface GameState {
  messages: ChatMessage[]
  pendingPhase: PendingPhase
  dmTurns: number
  world: {
    scene?: string
    scene_id?: string
    firstDmShown: boolean
  }
  sendPlayer: (text: string) => Promise<void>
  pushDM: (text: string) => void
  pushSystem: (text: string) => void
  pushImage: (url: string) => void
}

export const useGameStore = create<GameState>((set, get)=>({

  messages: [],
  pendingPhase: null,
  dmTurns: 0,
  world: { firstDmShown: false },

  pushSystem: (text) => set((s)=>({
    messages: [...s.messages, { id: nanoid(), role:'system', text }]
  })),

  pushDM: (text) => set((s)=>{
    const sanitized = sanitizeIntro(text, !s.world.firstDmShown)
    const wasFirst = !s.world.firstDmShown
    return {
      messages: [...s.messages, { id: nanoid(), role:'dm', text: sanitized }],
      dmTurns: s.dmTurns + 1,
      world: { ...s.world, firstDmShown: s.world.firstDmShown || wasFirst }
    }
  }),

  pushImage: (url) => set((s)=>({
    messages: [...s.messages, { id: nanoid(), role:'image', url }]
  })),

  sendPlayer: async (text: string) => {
    set({ pendingPhase: 'thinking', messages: [...get().messages, { id: nanoid(), role:'player', text }] })
    try {
      const world = get().world
      const data = await postChat(text, world)

      // UI команды
      if (Array.isArray(data.to_ui)) {
        for (const cmd of data.to_ui as ToUICommand[]) {
          if (cmd.cmd === 'show_image') {
            // ожидаем URL в payload.url, иначе игнор
            if (cmd.payload?.url) get().pushImage(cmd.payload.url)
          }
        }
      }

      // Печать ответа с тайпрайтером
      set({ pendingPhase: 'typing' })
      await typewriteDM(data.to_player || '', get, set)

      // Можно применить side-effects world (сцена)
      if (data.to_ui) {
        const sc = (data.to_ui as ToUICommand[]).find(c=>c.cmd==='set_scene')
        if (sc) set((s)=>({ world: { ...s.world, scene: sc.payload?.scene, scene_id: sc.payload?.scene_id } }))
      }

    } catch (e:any) {
      set((s)=>({
        messages: [...s.messages, { id: nanoid(), role:'system', text: 'Ошибка: ' + (e?.message || e) }]
      }))
    } finally {
      set({ pendingPhase: null })
    }
  },

}))

async function typewriteDM(full: string, get: any, set: any) {
  const id = nanoid()
  set((s:any)=>({ messages: [...s.messages, { id, role:'dm', text: '' }] }))
  const delay = (ms:number)=> new Promise(r=>setTimeout(r, ms))
  let buf = ''
  for (const ch of full) {
    buf += ch
    set((s:any)=>({ messages: s.messages.map((m:any)=> m.id===id ? { ...m, text: buf } : m )}))
    await delay(8) // быстро печатаем, но видно
  }
}

// tiny nanoid
