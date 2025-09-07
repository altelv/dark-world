import dynamic from "next/dynamic";
const App = dynamic(()=>import("../components/DarkWorldApp"), { ssr: false });
export default function Home(){ return <App/> }
