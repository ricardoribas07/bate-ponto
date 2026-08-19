import { useEffect, useState } from 'react';

export default function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const str = time.toLocaleTimeString('pt-BR', { hour12: false });
  return <div className="sidebar__clock">{str}</div>;
}
