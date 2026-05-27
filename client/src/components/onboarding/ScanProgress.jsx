export function ScanProgress({ vaultPath }) {
  return (
    <div className="max-w-md mx-auto text-center p-8">
      <p className="text-lg uppercase tracking-widest text-hud-accent glow mb-4">SCANNING…</p>
      <p className="text-xs opacity-70 font-mono break-all">{vaultPath}</p>
      <p className="text-xs opacity-50 mt-4">Looking for kanban-plugin board files.</p>
    </div>
  );
}
