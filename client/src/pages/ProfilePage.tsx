import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileService, type ProfileUser, type PurchaseItem } from '../services/profile.service';
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '' });

  useEffect(() => {
    Promise.all([ProfileService.getProfile(), ProfileService.getPurchases()])
      .then(([profileRes, purchasesRes]) => {
        setUser(profileRes.user ?? null);
        setPurchases(purchasesRes.purchases ?? []);
        if (profileRes.user) {
          setForm({
            firstName: profileRes.user.firstName ?? '',
            lastName: profileRes.user.lastName ?? '',
          });
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Erreur lors du chargement du profil.' }))
      .finally(() => setLoading(false));
  }, []);

  const isUnchanged =
    form.firstName === (user?.firstName ?? '') &&
    form.lastName === (user?.lastName ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await ProfileService.updateProfile({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      });
      setUser(updated.user);
      setForm({
        firstName: updated.user?.firstName ?? '',
        lastName: updated.user?.lastName ?? '',
      });
      setMessage({ type: 'success', text: 'Profil mis à jour.' });
    } catch {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setMessage(null);
    try {
      await ProfileService.deleteAccount();
      await signOut();
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err && typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
        ? (err as { response: { data: { message: string } } }).response.data.message
        : 'Erreur lors de la suppression du compte.';
      setMessage({ type: 'error', text: msg });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDownloadTicket = async (imageUrl: string | null, grandPrixName: string, section: string, seat: string) => {
    if (!imageUrl) return;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Erreur');
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `billet-${grandPrixName.replace(/\s+/g, '-')}-${section}-${seat}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      console.error('Téléchargement impossible');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="font-body text-f1-white/80">Chargement du profil...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="font-body text-f1-white/80">Profil introuvable.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8">
      <h1 className="font-racing text-4xl md:text-5xl text-f1-white italic uppercase mb-8">
        Mon <span className="text-f1-red">profil</span>
      </h1>

      <div className="bg-f1-asphalt rounded-xl p-6 md:p-8 border-2 border-f1-asphalt hover:border-f1-red/30 transition-colors mb-8">
        <h2 className="font-racing text-xl text-f1-white italic uppercase mb-4">Informations personnelles</h2>
        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded font-body text-sm ${
              message.type === 'success'
                ? 'bg-f1-green/20 border border-f1-green text-f1-white'
                : 'bg-f1-red/20 border border-f1-red text-f1-white'
            }`}
          >
            {message.text}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-body text-f1-white/80 text-sm font-medium mb-2">Prénom</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full bg-f1-carbon border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white font-body placeholder:text-f1-white/40 focus:outline-none focus:border-f1-red transition-colors"
                placeholder="Optionnel"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block font-body text-f1-white/80 text-sm font-medium mb-2">Nom</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full bg-f1-carbon border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white font-body placeholder:text-f1-white/40 focus:outline-none focus:border-f1-red transition-colors"
                placeholder="Optionnel"
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <label className="block font-body text-f1-white/80 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="w-full bg-f1-carbon/80 border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white/60 font-body cursor-not-allowed"
            />
            <p className="font-body text-f1-white/50 text-xs mt-1">L'email ne peut pas être modifié.</p>
          </div>
          <button
            type="submit"
            disabled={saving || isUnchanged}
            className="bg-f1-white text-f1-carbon font-racing font-bold py-3 px-6 -skew-x-12 hover:bg-f1-red hover:text-f1-white transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed uppercase text-sm"
          >
            <span className="inline-block skew-x-12">{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
          </button>
        </form>

        <div className="mt-10 pt-8 border-t-2 border-f1-asphalt">
          {showDeleteConfirm ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-body text-f1-white/80 text-sm">Confirmer la suppression du compte ?</span>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="font-racing font-bold py-2 px-4 -skew-x-12 border-2 border-f1-red text-f1-red hover:bg-f1-red hover:text-f1-white transition-colors uppercase text-xs disabled:opacity-50"
              >
                <span className="inline-block skew-x-12">{deleting ? 'Suppression...' : 'Oui, supprimer'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="font-body text-sm text-f1-white/80 hover:text-f1-white underline disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="font-racing font-bold py-2 px-4 -skew-x-12 border-2 border-f1-red/70 text-f1-red/90 hover:border-f1-red hover:text-f1-red hover:bg-f1-red/10 transition-colors uppercase text-xs"
            >
              <span className="inline-block skew-x-12">Supprimer mon compte</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-f1-asphalt rounded-xl p-6 md:p-8 border-2 border-f1-asphalt hover:border-f1-red/30 transition-colors">
        <h2 className="font-racing text-xl text-f1-white italic uppercase mb-4">Mes achats</h2>
        {purchases.length === 0 ? (
          <p className="font-body text-f1-white/60">Vous n'avez pas encore acheté de billet.</p>
        ) : (
          <ul className="space-y-4">
            {purchases.map((p) => (
              <li
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-f1-carbon rounded-xl border-2 border-f1-asphalt hover:border-f1-red/40 transition-colors"
              >
                <div>
                  <p className="font-racing text-f1-white italic uppercase font-bold">{p.ticket.grandPrix.name}</p>
                  <p className="font-body text-f1-white/70 text-sm">{p.ticket.grandPrix.circuitName}</p>
                  <p className="font-body text-f1-white/50 text-xs mt-1">
                    {new Date(p.ticket.grandPrix.date).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="font-body text-f1-white/70 text-sm mt-2">
                    {p.ticket.section} · Rang {p.ticket.row} · Place {p.ticket.seat}
                  </p>
                  <p className="font-racing text-f1-red font-bold mt-1">{Number(p.total).toFixed(2)} €</p>
                </div>
                <div>
                  {p.ticket.imageUrl ? (
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadTicket(
                          p.ticket.imageUrl,
                          p.ticket.grandPrix.name,
                          p.ticket.section,
                          p.ticket.seat
                        )
                      }
                      className="bg-f1-white text-f1-carbon font-racing font-bold py-2 px-4 -skew-x-12 hover:bg-f1-red hover:text-f1-white transition-colors duration-200 text-sm uppercase"
                    >
                      <span className="inline-block skew-x-12">Télécharger le billet</span>
                    </button>
                  ) : (
                    <span className="font-body text-f1-white/50 text-sm">Aucune image</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
