import { useState } from "react";
import { BottomNav, type Tab } from "./ui/BottomNav";
import { InicioScreen } from "./screens/InicioScreen";
import { TiendaScreen } from "./screens/TiendaScreen";
import { EstiloScreen } from "./screens/EstiloScreen";
import { ArmarioScreen } from "./screens/armario/ArmarioScreen";

export function App() {
  const [tab, setTab] = useState<Tab>("inicio");
  return (
    <div className="app">
      <main className="screen">
        {tab === "inicio" && <InicioScreen />}
        {tab === "tienda" && <TiendaScreen />}
        {tab === "estilo" && <EstiloScreen />}
        {tab === "armario" && <ArmarioScreen />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
