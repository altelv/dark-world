export async function postChat(userText: string, world: any) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: userText, world }),
  })
  if (!res.ok) {
    const t = await res.text().catch(()=> '')
    throw new Error('Chat API error: ' + res.status + ' ' + t)
  }
  return res.json()
}
