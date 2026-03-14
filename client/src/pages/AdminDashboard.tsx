import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileService } from '../services/profile.service';
import { AdminService, type AdminUser, type AdminTicket, type AdminStats } from '../services/admin.service';

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`bg-f1-carbon border-2 ${accent ? 'border-f1-red' : 'border-f1-asphalt'} p-5 relative overflow-hidden`}>
      <div className="absolute top-0 left-0 w-1 h-full bg-f1-red" />
      <p className="font-body text-xs uppercase tracking-widest text-f1-white/50 mb-2 pl-3">{label}</p>
      <p className={`font-racing text-3xl italic pl-3 ${accent ? 'text-f1-red' : 'text-f1-white'}`}>{value}</p>
      {sub && <p className="font-body text-xs text-f1-white/50 mt-1 pl-3">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    ProfileService.getProfile()
      .then((res) => {
        if (!res.user || res.user.role !== 'ADMIN') {
          navigate('/', { replace: true });
          return;
        }
        setCheckingAuth(false);
        return Promise.all([AdminService.getStats(), AdminService.getUsers(), AdminService.getTickets()]);
      })
      .then((data) => {
        if (data) {
          setStats(data[0]);
          setUsers(data[1].users);
          setTickets(data[2].tickets);
        }
      })
      .catch(() => navigate('/', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleDeleteTicket = async (id: string) => {
    setDeletingId(id);
    try {
      await AdminService.deleteTicket(id);
      setTickets((prev) => prev.filter((t) => t.id !== id));
    } catch {
      console.error('Erreur suppression ticket');
    } finally {
      setDeletingId(null);
    }
  };

  if (checkingAuth || loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="font-body text-f1-white/80">Chargement...</p>
      </div>
    );
  }

  const fmt = (n: number | null | undefined, suffix = ' €') =>
    n == null ? '—' : `${n.toFixed(2)}${suffix}`;

  return (
    <div className="max-w-6xl mx-auto p-6 md:p-8">
      <h1 className="font-racing text-4xl md:text-5xl text-f1-white italic uppercase mb-8">
        Admin <span className="text-f1-red">dashboard</span>
      </h1>

      {stats && (
        <>
          <h2 className="font-racing text-xl text-f1-white italic uppercase mb-4">
            Statistiques <span className="text-f1-red">générales</span>
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Utilisateurs" value={stats.totalUsers} sub={`dont ${stats.totalAdmins} admin(s)`} />
            <StatCard label="Billets en vente" value={stats.ticketsOnSale} />
            <StatCard label="Billets vendus" value={stats.ticketsSold} />
            <StatCard label="Chiffre d'affaires" value={fmt(stats.totalRevenue)} accent sub={`${stats.totalSales} vente(s)`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Prix moyen en vente" value={fmt(stats.avgOnSalePrice)} />
            <StatCard label="Prix min en vente" value={fmt(stats.minOnSalePrice)} />
            <StatCard label="Prix max en vente" value={fmt(stats.maxOnSalePrice)} />
            <StatCard label="Prix moyen vendu" value={fmt(stats.avgSoldPrice)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            <div className="bg-f1-carbon border-2 border-f1-asphalt p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-f1-red" />
              <p className="font-body text-xs uppercase tracking-widest text-f1-white/50 mb-3 pl-3">Dernière vente</p>
              {stats.lastSale ? (
                <div className="pl-3 space-y-1">
                  <p className="font-racing text-xl text-f1-white italic">{stats.lastSale.gpName}</p>
                  <p className="font-body text-sm text-f1-white/70">
                    Tribune {stats.lastSale.section} · Rang {stats.lastSale.row} · Place {stats.lastSale.seat}
                  </p>
                  <p className="font-racing text-f1-red text-lg">{stats.lastSale.total.toFixed(2)} €</p>
                  <p className="font-body text-xs text-f1-white/50">
                    {new Date(stats.lastSale.date).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                    {' · '}{stats.lastSale.buyerEmail}
                  </p>
                </div>
              ) : (
                <p className="font-body text-f1-white/50 pl-3">Aucune vente pour l'instant.</p>
              )}
            </div>

            <div className="bg-f1-carbon border-2 border-f1-asphalt p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-f1-red" />
              <p className="font-body text-xs uppercase tracking-widest text-f1-white/50 mb-3 pl-3">GP le plus actif</p>
              {stats.topGp ? (
                <div className="pl-3">
                  <p className="font-racing text-xl text-f1-white italic">{stats.topGp.name}</p>
                  <p className="font-body text-sm text-f1-white/70 mt-1">{stats.topGp.count} billet(s) mis en vente</p>
                </div>
              ) : (
                <p className="font-body text-f1-white/50 pl-3">Aucun billet encore.</p>
              )}
            </div>
          </div>
        </>
      )}

      <section className="bg-f1-asphalt rounded-xl p-6 border-2 border-f1-asphalt mb-8">
        <h2 className="font-racing text-xl text-f1-white italic uppercase mb-4">Utilisateurs</h2>
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="text-left text-f1-white/70 border-b-2 border-f1-carbon">
                <th className="py-3 px-2">Email</th>
                <th className="py-3 px-2">Prénom</th>
                <th className="py-3 px-2">Nom</th>
                <th className="py-3 px-2">Rôle</th>
                <th className="py-3 px-2">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-f1-carbon text-f1-white/90">
                  <td className="py-3 px-2">{u.email}</td>
                  <td className="py-3 px-2">{u.firstName}</td>
                  <td className="py-3 px-2">{u.lastName}</td>
                  <td className="py-3 px-2">
                    <span className={u.role === 'ADMIN' ? 'text-f1-red font-semibold' : ''}>{u.role}</span>
                  </td>
                  <td className="py-3 px-2 text-f1-white/60">
                    {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <p className="font-body text-f1-white/60 py-4">Aucun utilisateur.</p>
        )}
      </section>

      <section className="bg-f1-asphalt rounded-xl p-6 border-2 border-f1-asphalt">
        <h2 className="font-racing text-xl text-f1-white italic uppercase mb-4">Billets</h2>
        <div className="overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="text-left text-f1-white/70 border-b-2 border-f1-carbon">
                <th className="py-3 px-2">GP</th>
                <th className="py-3 px-2">Section / Rang / Place</th>
                <th className="py-3 px-2">Prix</th>
                <th className="py-3 px-2">Statut</th>
                <th className="py-3 px-2">Vendeur</th>
                <th className="py-3 px-2">Billet</th>
                <th className="py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-f1-carbon text-f1-white/90">
                  <td className="py-3 px-2">{t.grandPrix.name}</td>
                  <td className="py-3 px-2">{t.section} / {t.row} / {t.seat}</td>
                  <td className="py-3 px-2 text-f1-red font-semibold">{Number(t.price).toFixed(2)} €</td>
                  <td className="py-3 px-2">{t.status}</td>
                  <td className="py-3 px-2">{t.seller.email}</td>
                  <td className="py-3 px-2">
                    {t.imageUrl ? (
                      <button
                        type="button"
                        onClick={() => setPreviewUrl(t.imageUrl)}
                        className="font-racing text-xs font-bold py-1.5 px-3 -skew-x-12 border-2 border-f1-green text-f1-green hover:bg-f1-green hover:text-f1-carbon transition-colors uppercase"
                      >
                        <span className="inline-block skew-x-12">Voir</span>
                      </button>
                    ) : (
                      <span className="font-body text-f1-white/50 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteTicket(t.id)}
                      disabled={deletingId === t.id}
                      className="font-racing text-xs font-bold py-1.5 px-3 -skew-x-12 border-2 border-f1-red text-f1-red hover:bg-f1-red hover:text-f1-white transition-colors uppercase disabled:opacity-50"
                    >
                      <span className="inline-block skew-x-12">{deletingId === t.id ? '...' : 'Supprimer'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tickets.length === 0 && (
          <p className="font-body text-f1-white/60 py-4">Aucun billet.</p>
        )}
      </section>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu du billet"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-xl bg-f1-carbon border-2 border-f1-asphalt shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewUrl(null)}
              className="absolute top-2 right-2 z-10 rounded bg-f1-asphalt p-2 text-f1-white hover:bg-f1-red transition-colors font-racing text-sm uppercase"
              aria-label="Fermer"
            >
              Fermer
            </button>
            {previewUrl.toLowerCase().includes('.pdf') ? (
              <iframe
                src={previewUrl}
                title="Aperçu du billet"
                className="w-full min-h-[80vh] rounded-xl"
                style={{ height: '85vh' }}
              />
            ) : (
              <img
                src={previewUrl}
                alt="Aperçu du billet"
                className="max-h-[90vh] w-auto object-contain rounded-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
