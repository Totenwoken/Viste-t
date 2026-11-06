export type Tab = "armario" | "inicio" | "tienda" | "estilo";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "armario", icon: "👕", label: "Armario" },
  { id: "inicio", icon: "🏠", label: "Inicio" },
  { id: "tienda", icon: "📷", label: "Tienda" },
  { id: "estilo", icon: "✨", label: "Estilo" },
];

export function BottomNav({ active, onChange }: { active: Tab; onChange(tab: Tab): void }) {
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className={t.id === active ? "on" : undefined}
          aria-current={t.id === active ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
