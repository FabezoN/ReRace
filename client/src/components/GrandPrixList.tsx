import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrandPrixService } from '../services/grand-prix.service';
import type { GrandPrix } from '../services/grand-prix.service';

const CIRCUIT_TO_IMAGE: Record<string, string> = {
  'australia': 'Australia.jpg',
  'china': 'China.jpg',
  'japan': 'Japan.jpg',
  'bahrain': 'Bahrain.webp',
  'saudi arabia': 'Saudi-Arabia.jpg',
  'miami': 'Miam-USA.jpg',
  'las vegas': 'LasVegas-USA.webp',
  'austin': 'Austin-USA.jpg',
  'usa': 'Austin-USA.jpg',
  'canada': 'Canada.webp',
  'monaco': 'Monaco.jpg',
  'spain': 'Barcelona-Spain.jpg',
  'austria': 'Austria.webp',
  'uk': 'UK.jpg',
  'belgium': 'Belgium.avif',
  'hungary': 'Hungary.jpg',
  'netherlands': 'Netherlands.jpg',
  'italy': 'Italy.avif',
  'azerbaijan': 'Azerbaijan.jpg',
  'singapore': 'Singapore.avif',
  'mexico': 'Mexico.jpg',
  'brazil': 'Brazil.webp',
  'qatar': 'Qatar.jpg',
  'uae': 'UAE.avif',
};

function getCircuitImage(country: string, name: string, circuitName: string): string {
  if (!country) return '/circuits/default.png';

  const candidates = [name, circuitName, country].map((s) => (s ?? '').toLowerCase().trim());

  for (const candidate of candidates) {
    for (const [key, file] of Object.entries(CIRCUIT_TO_IMAGE)) {
      if (candidate.includes(key)) return `/circuits/${file}`;
    }
  }

  const fallback = country.toLowerCase().trim().replace(/\s+/g, '-') + '.jpg';
  return `/circuits/${fallback}`;
}

function GpCard({ gp, isPast, navigate }: { gp: GrandPrix; isPast: boolean; navigate: (path: string) => void }) {
  return (
    <div
      className={`rounded-xl overflow-hidden border-2 transition-all duration-300 group ${
        isPast
          ? 'bg-f1-carbon border-f1-asphalt/50 opacity-60 cursor-default'
          : 'bg-f1-asphalt border-f1-asphalt hover:border-f1-red cursor-pointer'
      }`}
      onClick={() => navigate(`/races/${gp.id}`)}
    >
      <div className="h-52 md:h-56 bg-f1-carbon relative overflow-hidden">
        <img
          src={getCircuitImage(gp.country, gp.name, gp.circuitName)}
          alt={gp.circuitName}
          className={`w-full h-full object-cover transition-all duration-500 ${
            isPast
              ? 'opacity-30 grayscale'
              : 'opacity-90 group-hover:opacity-100 group-hover:scale-105'
          }`}
          onError={(e) => { e.currentTarget.src = '/circuits/default.png'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" aria-hidden />
        {isPast && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-racing text-f1-white/80 text-lg italic uppercase bg-black/60 px-4 py-2 -skew-x-12">
              Terminé
            </span>
          </div>
        )}
        <div className={`absolute top-3 right-3 text-f1-white text-xs font-racing font-bold px-3 py-1.5 -skew-x-12 shadow-lg z-10 ${isPast ? 'bg-f1-white/30' : 'bg-f1-red'}`}>
          {new Date(gp.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>

      <div className="p-5 md:p-6">
        <h2 className={`font-racing text-xl md:text-2xl mb-1 italic uppercase ${isPast ? 'text-f1-white/60' : 'text-f1-white'}`}>
          {gp.name}
        </h2>
        <p className="font-body text-f1-white/50 text-sm mb-2">{gp.circuitName}</p>
        <p className="font-body text-f1-white/40 text-xs uppercase tracking-wider mb-5">
          {new Date(gp.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {isPast ? (
          <div className="w-full bg-f1-asphalt/50 text-f1-white/40 font-racing font-bold py-3 px-4 -skew-x-12 text-sm uppercase text-center">
            <span className="inline-block skew-x-12">Grand Prix passé</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/races/${gp.id}`); }}
            className="w-full bg-f1-white text-f1-carbon font-racing font-bold py-3 px-4 -skew-x-12 hover:bg-f1-red hover:text-f1-white transition-colors duration-200 text-sm uppercase"
          >
            <span className="inline-block skew-x-12">Voir les billets</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default function GrandPrixList() {
  const navigate = useNavigate();
  const [races, setRaces] = useState<GrandPrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    GrandPrixService.getAll()
      .then((data) => {
        const sorted = [...data].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
        setRaces(sorted);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Erreur API:', error);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="font-body text-f1-white/80">Chargement du calendrier...</p>
      </div>
    );
  }

  if (races.length === 0) {
    return (
      <div className="p-8 min-h-[60vh]">
        <h1 className="font-racing text-4xl md:text-5xl text-f1-white mb-6">
          CALENDRIER <span className="text-f1-red">2026</span>
        </h1>
        <div className="bg-f1-asphalt rounded-xl border border-f1-asphalt p-12 text-center">
          <p className="text-f1-white/80 font-body">Aucun Grand Prix disponible pour le moment.</p>
        </div>
      </div>
    );
  }

  const now = new Date();

  const matchesSearch = (gp: GrandPrix) => {
    const searchLower = search.trim().toLowerCase();
    if (!searchLower) return true;
    const date = new Date(gp.date);
    const dateFormats = [
      date.toLocaleDateString('fr-FR'),
      date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      date.toLocaleDateString('fr-FR', { month: 'long' }),
      String(date.getFullYear()),
    ].map((s) => s.toLowerCase());
    return (
      gp.name.toLowerCase().includes(searchLower) ||
      gp.circuitName.toLowerCase().includes(searchLower) ||
      (gp.country && gp.country.toLowerCase().includes(searchLower)) ||
      dateFormats.some((d) => d.includes(searchLower))
    );
  };

  const upcomingRaces = races.filter((gp) => new Date(gp.date) >= now && matchesSearch(gp));
  const pastRaces = races.filter((gp) => new Date(gp.date) < now && matchesSearch(gp)).reverse();
  const filteredRaces = [...upcomingRaces, ...pastRaces];

  return (
    <div className="p-6 md:p-8">
      <h1 className="font-racing text-4xl md:text-6xl lg:text-7xl text-f1-white mb-10 md:mb-12">
        CALENDRIER <span className="text-f1-red">2026</span>
      </h1>

      <div className="mb-8 md:mb-10">
        <label htmlFor="gp-search" className="sr-only">
          Rechercher un Grand Prix
        </label>
        <div className="w-full max-w-xl -skew-x-12 border-2 border-f1-asphalt bg-f1-carbon focus-within:border-f1-red transition-colors">
          <input
            id="gp-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un GP, un circuit, un pays ou une date..."
            className="w-full skew-x-12 border-0 bg-transparent py-3 px-4 font-body text-f1-white placeholder:text-f1-white/40 focus:outline-none"
            aria-label="Rechercher un Grand Prix"
          />
        </div>
        {search.trim() && (
          <p className="mt-2 font-body text-sm text-f1-white/60">
            {filteredRaces.length} GP{filteredRaces.length !== 1 ? 's' : ''} trouvé
            {filteredRaces.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {filteredRaces.length === 0 ? (
        <div className="bg-f1-asphalt rounded-xl border-2 border-f1-asphalt p-12 text-center">
          <p className="text-f1-white/80 font-body">
            {search.trim() ? 'Aucun Grand Prix ne correspond à votre recherche.' : 'Aucun Grand Prix disponible.'}
          </p>
        </div>
      ) : (
        <>
          {/* GP à venir */}
          {upcomingRaces.length > 0 && (
            <div className="mb-16">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {upcomingRaces.map((gp) => (
                  <GpCard key={gp.id} gp={gp} isPast={false} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* GP passés */}
          {pastRaces.length > 0 && (
            <div>
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px flex-1 bg-f1-asphalt/60" />
                <h2 className="font-racing text-2xl md:text-3xl text-f1-white/40 uppercase italic">
                  Grands Prix <span className="text-f1-red/50">Terminés</span>
                </h2>
                <div className="h-px flex-1 bg-f1-asphalt/60" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {pastRaces.map((gp) => (
                  <GpCard key={gp.id} gp={gp} isPast={true} navigate={navigate} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
