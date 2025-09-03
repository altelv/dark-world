export function nanoid(size=12){
  const chars='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  let id=''
  for (let i=0;i<size;i++) id += chars[Math.floor(Math.random()*chars.length)]
  return id
}
