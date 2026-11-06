import { useState } from "react";
import { BottomNav, type Tab } from "./ui/BottomNav";
import { InicioScreen } from "./screens/InicioScreen";
import { TiendaScreen } from "./screens/TiendaScreen";
import { EstiloScreen } from "./screens/EstiloScreen";

export function App() {
  const [tab, setTab] = useState<Tab>("inicio");
  return (
    <div className="app">
      <main className="screen">
        {tab === "inicio" && <InicioScreen />}
        {tab === "tienda" && <TiendaScreen />}
        {tab === "estilo" && <EstiloScreen />}
        {tab === "armario" && <p className="muted">Armario</p>}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
