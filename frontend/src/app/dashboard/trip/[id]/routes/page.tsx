'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Map, MapPin } from 'lucide-react';

type Route = {
  id: string;
  fromLocation: string;
  toLocation: string;
  transportMode: string;
  distanceKm: number;
  durationMinutes: number;
  routeData?: { lineString?: [number, number][] };
};

export default function RoutesPage() {
  const router = useRouter();
  const tripId = useParams().id as string;
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selected, setSelected] = useState<Route | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);

  useEffect(() => {
    (async () => {
      const response = await fetch(`http://localhost:5000/api/trips/${tripId}/routes`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      if (!response.ok) setError(data.message || data.error || 'Could not load routes');
      else setRoutes(data.routes || []);
      setLoading(false);
    })().catch((requestError) => {
      setError(requestError.message);
      setLoading(false);
    });
  }, [tripId]);

  useEffect(() => {
    if (!selected || !mapElement.current || map.current) return;
    (async () => {
      const L = (await import('leaflet')).default;
      const points = (selected.routeData?.lineString || []).map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      if (points.length < 2) {
        setError('This is an older route record. Create a new trip to save the map line.');
        return;
      }
      const instance = L.map(mapElement.current!).setView(points[0], 7);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap contributors',
      }).addTo(instance);
      L.marker(points[0]).addTo(instance).bindPopup(selected.fromLocation);
      L.marker(points[points.length - 1]).addTo(instance).bindPopup(selected.toLocation);
      const line = L.polyline(points, { color: '#2563eb', weight: 5 }).addTo(instance);
      instance.fitBounds(line.getBounds(), { padding: [40, 40] });
      map.current = instance;
    })();
  }, [selected]);

  const closeMap = () => {
    map.current?.remove();
    map.current = null;
    setSelected(null);
  };

  if (loading) return <main className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></main>;

  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <button onClick={() => router.back()} className="mb-6 flex gap-2 text-slate-900"><ArrowLeft /> Back</button>
    <h1 className="mb-6 text-3xl font-bold">Route Details</h1>
    {error && <p className="mb-4 text-red-600">{error}</p>}
    <div className="space-y-4">
      {routes.map((route) => <article key={route.id} className="rounded-xl bg-white p-6 text-slate-900 shadow">
        <h2 className="flex gap-2 text-xl font-semibold"><MapPin />{route.fromLocation} {'->'} {route.toLocation}</h2>
        <p className="mt-2 capitalize">{route.transportMode} · {route.distanceKm.toFixed(1)} km · {Math.floor(route.durationMinutes / 60)}h {route.durationMinutes % 60}m</p>
        <button onClick={() => setSelected(route)} className="mt-4 flex gap-2 rounded bg-blue-600 px-4 py-2 text-white"><Map /> View route on map</button>
      </article>)}
    </div>
    {selected && <div className="fixed inset-0 z-50 bg-black/60 p-6">
      <section className="mx-auto flex h-full max-w-6xl flex-col rounded-xl bg-white text-slate-900">
        <header className="flex items-center justify-between p-4"><div><b>{selected.fromLocation} {'->'} {selected.toLocation}</b><p className="text-sm text-slate-500">Amazon Location Routes</p></div><button onClick={closeMap} className="rounded px-3 py-2">Close</button></header>
        <div ref={mapElement} className="min-h-0 flex-1" />
      </section>
    </div>}
  </main>;
}
