import { useState } from "react";
import { BottomNav, type Tab } from "./ui/BottomNav";
import { InicioScreen, type OutfitRequest } from "./screens/InicioScreen";
import { TiendaScreen } from "./screens/TiendaScreen";
import { EstiloScreen } from "./screens/EstiloScreen";
import { ArmarioScreen } from "./screens/armario/ArmarioScreen";
import { OutfitScreen } from "./screens/outfit/OutfitScreen";

export function App() {
  const [tab, setTab] = useState<Tab>("inicio");
  const [request, setRequest] = useState<OutfitRequest | null>(null);
  // Cada pedido nuevo vuelve a montar la pantalla de resultado desde cero.
  const [requestKey, setRequestKey] = useState(0);

  return (
    <div className="app">
      <main className="screen">
        {/* El resultado sigue montado (oculto) en otras pestañas: al volver no se genera otro ni se pierden los candados. */}
        {request && (
          <div hidden={tab !== "inicio"}>
            <OutfitScreen key={requestKey} request={request} onBack={() => setRequest(null)} />
          </div>
        )}
        {tab === "inicio" && !request && (
          <InicioScreen
            onRequest={(r) => {
              setRequest(r);
              setRequestKey((k) => k + 1);
            }}
          />
        )}
        {tab === "tienda" && <TiendaScreen />}
        {tab === "estilo" && <EstiloScreen />}
        {tab === "armario" && <ArmarioScreen />}
      </main>
      <BottomNav
        active={tab}
        onChange={(t) => {
          // Tocar "Inicio" estando en Inicio vuelve a la pantalla principal.
          if (t === "inicio" && tab === "inicio") setRequest(null);
          setTab(t);
        }}
      />
    </div>
  );
}
