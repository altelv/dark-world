import { HeroPanel } from "./HeroPanel"
import { InventoryPanel } from "./InventoryPanel"
import { Chat } from "./Chat"
import { StatusBar } from "./StatusBar"
export function Layout(){
  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1"><HeroPanel/></div>
        <div className="md:col-span-1">
          <StatusBar/>
          <div className="h-[75vh] bg-coal/60 rounded-xl2 p-4 border border-iron"><Chat/></div>
        </div>
        <div className="md:col-span-1"><InventoryPanel/></div>
      </div>
    </div>
  )
}
