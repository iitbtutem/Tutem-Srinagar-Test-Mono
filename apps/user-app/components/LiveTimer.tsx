
import { useEffect, useState } from "react";
import { Text } from '@tutem/ui';


// Helpers

function formatElapsed(startTimestamp: number | undefined): string {
  if(startTimestamp === undefined) return "--:--:--";
  const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};


export default function LiveTimer({ startTimestamp }: { startTimestamp: number | undefined }) {
  const [display, setDisplay] = useState(() => formatElapsed(startTimestamp));
  useEffect(() => {
    const id = setInterval(() => setDisplay(formatElapsed(startTimestamp)), 1000);
    return () => clearInterval(id);
  }, [startTimestamp]);
  return (
    <Text className="text-emerald-400 text-xl font-extrabold tracking-tight tabular-nums">
      {display}
    </Text>
  );
}