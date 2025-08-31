
import React, { useState } from 'react'
import { LeftPanelCharacter } from './components/LeftPanelCharacter'
import { CenterChat } from './components/CenterChat'
import { RightPanelInventory } from './components/RightPanelInventory'
import { seedCharacter } from './game/examples/seedCharacter'
import type { RollRequest, RollResolution } from './game/state/types'
import './styles.css'

export default function App(){
  const [mode, setMode] = useState<'Бой'|'Сюжет'>('Сюжет')
  const [char, setChar] = useState(seedCharacter())
  const [pendingRoll, setPendingRoll] = useState<RollRequest | null>(null)
  const [lastRoll, setLastRoll] = useState<RollResolution | null>(null)
  const [enemies, setEnemies] = useState([
    { name:'Гоблин', state:'Не ранены'}, { name:'Огр', state:'Не ранены'}
  ])

  return (
    <div className="app-grid">
      <div className="panel">
        <div className="panel-header">Персонаж</div>
        <div className="panel-body">
          <LeftPanelCharacter character={char} onChange={setChar} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>Чат</div>
            <div className="mode-switch">
              {(['Сюжет','Бой'] as const).map(m=>(
                <div key={m} className={'mode-chip ' + (mode===m?'active':'')} onClick={()=>setMode(m)}>{m}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="panel-body">
          <CenterChat character={char} setCharacter={setChar}
            mode={mode} enemies={enemies} setEnemies={setEnemies}
            pendingRoll={pendingRoll} setPendingRoll={setPendingRoll}
            lastRoll={lastRoll} setLastRoll={setLastRoll}
          />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">Инвентарь (позже)</div>
        <div className="panel-body"><RightPanelInventory/></div>
      </div>
    </div>
  )
}
