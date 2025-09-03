const INTRO = 'Добро пожаловать в Темный мир'

export function sanitizeIntro(text: string, isFirstDM: boolean) {
  if (!text) return text
  if (isFirstDM) return text
  const idx = text.indexOf(INTRO)
  if (idx === -1) return text
  // Вырезаем повторяющийся интро-фрагмент
  return text.replace(new RegExp(INTRO + '[^\n]*\n?', 'gi'), '').trim() || text
}
