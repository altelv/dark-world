import { useEffect } from "react"
import { useGameStore } from "@store/game"
import { Layout } from "@components/Layout"
export default function App(){ const bootstrap = useGameStore(s=>s.bootstrap); useEffect(()=>{ bootstrap() }, [bootstrap]); return <Layout/> }
