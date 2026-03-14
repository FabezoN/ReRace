import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TicketService, GrandPrixService, PaymentService } from '../services/grand-prix.service';
import type { GrandPrix, Ticket } from '../services/grand-prix.service';
import { useAuth } from '../contexts/AuthContext';

interface TicketListProps {
  grandPrixId: string;
}

export default function TicketList({ grandPrixId }: TicketListProps) {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [grandPrix, setGrandPrix] = useState<GrandPrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | null>(null);

  const sortedTickets = [...tickets].sort((a, b) => {
    if (!priceSort) return 0;
    const pa = Number(a.price);
    const pb = Number(b.price);
    return priceSort === 'asc' ? pa - pb : pb - pa;
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ticketsData, gpData] = await Promise.all([
          TicketService.getByGrandPrix(grandPrixId),
          GrandPrixService.getById(grandPrixId),
        ]);
        setTickets(ticketsData);
        setGrandPrix(gpData);
      } catch (error) {
        console.error('Erreur lors du chargement:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [grandPrixId]);

  useEffect(() => {
    const userEmail = (user as { email?: string } | null)?.email;
    if (userEmail) {
      setBuyerEmail(userEmail);
    }
  }, [user]);

  const handleBuyClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setEmailError(null);
    setShowEmailModal(true);
  };

  const handlePurchase = async () => {
    if (!selectedTicketId) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!buyerEmail || !emailRegex.test(buyerEmail)) {
      setEmailError('Veuillez entrer une adresse email valide');
      return;
    }

    try {
      setPurchaseLoading(selectedTicketId);
      setEmailError(null);
      setError(null);
      const { url } = await PaymentService.createCheckoutSession(selectedTicketId, buyerEmail);
      
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      console.error('Erreur paiement:', err);
      setError(err.response?.data?.message || 'Erreur lors de la création du paiement');
      setPurchaseLoading(null);
      setShowEmailModal(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="font-body text-f1-white/80">Chargement des billets...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Link
        to="/races"
        className="mb-6 inline-flex items-center font-body text-f1-white/60 hover:text-f1-white transition-colors"
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Retour au calendrier
      </Link>
      {error && (
        <div className="mb-6 p-4 bg-f1-red/20 border border-f1-red rounded-lg font-body text-f1-white">
          {error}
        </div>
      )}
      {grandPrix && (
        <div className="mb-8">
          <h1 className="font-racing text-3xl text-f1-white italic uppercase">{grandPrix.name}</h1>
          <p className="font-body text-f1-white/70 mt-1">{grandPrix.circuitName}</p>
          <p className="font-body text-f1-white/50 text-sm mt-1">
            {new Date(grandPrix.date).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      )}
      {grandPrix && new Date(grandPrix.date) < new Date() && (
        <div className="mb-6 flex items-center gap-3 border-2 border-f1-asphalt/60 bg-f1-asphalt/30 px-5 py-4 -skew-x-12">
          <span className="inline-block skew-x-12 font-body text-f1-white/70 text-sm">
            Ce Grand Prix est terminé — les achats de billets ne sont plus disponibles.
          </span>
        </div>
      )}
      {tickets.length === 0 && grandPrix && new Date(grandPrix.date) >= new Date() ? (
        <div className="bg-f1-asphalt rounded-xl p-10 text-center border-2 border-f1-asphalt">
          <p className="text-f1-white/80 font-body text-lg">Aucun billet disponible pour ce Grand Prix.</p>
          <p className="text-f1-white/50 font-body text-sm mt-2">Revenez plus tard ou soyez le premier à vendre !</p>
        </div>
      ) : tickets.length === 0 ? null : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="font-body text-f1-white/70 text-sm">Trier par prix :</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriceSort(priceSort === 'asc' ? null : 'asc')}
                className={`font-racing text-xs font-bold py-2 px-4 rounded border-2 uppercase transition-colors -skew-x-12 ${
                  priceSort === 'asc'
                    ? 'bg-f1-red border-f1-red text-f1-white'
                    : 'border-f1-asphalt text-f1-white/80 hover:border-f1-red hover:text-f1-white'
                }`}
              >
                <span className="inline-block skew-x-12">Croissant</span>
              </button>
              <button
                type="button"
                onClick={() => setPriceSort(priceSort === 'desc' ? null : 'desc')}
                className={`font-racing text-xs font-bold py-2 px-4 rounded border-2 uppercase transition-colors -skew-x-12 ${
                  priceSort === 'desc'
                    ? 'bg-f1-red border-f1-red text-f1-white'
                    : 'border-f1-asphalt text-f1-white/80 hover:border-f1-red hover:text-f1-white'
                }`}
              >
                <span className="inline-block skew-x-12">Décroissant</span>
              </button>
              {priceSort && (
                <button
                  type="button"
                  onClick={() => setPriceSort(null)}
                  className="font-body text-xs text-f1-white/60 hover:text-f1-white underline"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTickets.map((ticket) => {
            const isPast = grandPrix ? new Date(grandPrix.date) < new Date() : false;
            return (
            <div
              key={ticket.id}
              className={`rounded-xl p-6 border-2 transition-all duration-300 ${
                isPast
                  ? 'bg-f1-asphalt/40 border-f1-asphalt/40 opacity-60'
                  : 'bg-f1-asphalt border-f1-asphalt hover:border-f1-red'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <span className={`font-racing text-3xl font-bold ${isPast ? 'text-f1-white/50' : 'text-f1-red'}`}>
                  {Number(ticket.price).toFixed(2)} €
                </span>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="font-body text-f1-white/60">Tribune / Gradin</span>
                  <span className="font-body text-f1-white font-medium">{ticket.section}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-f1-white/60">Rangée</span>
                  <span className="font-body text-f1-white font-medium">{ticket.row}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-body text-f1-white/60">Place</span>
                  <span className="font-body text-f1-white font-medium">{ticket.seat}</span>
                </div>
              </div>
              <button
                className="w-full bg-f1-white text-f1-carbon font-racing font-bold py-3 rounded-lg hover:bg-f1-red hover:text-f1-white transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed -skew-x-12"
                disabled={purchaseLoading === ticket.id || isPast}
                onClick={() => !isPast && handleBuyClick(ticket.id)}
              >
                <span className="inline-block skew-x-12">
                  {purchaseLoading === ticket.id ? 'Redirection...' : isPast ? 'Indisponible' : 'Acheter'}
                </span>
              </button>
            </div>
            );
          })}
          </div>
        </>
      )}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-f1-asphalt rounded-xl p-6 w-full max-w-md border-2 border-f1-asphalt">
            <h2 className="font-racing text-2xl text-f1-white italic uppercase mb-2">Finaliser l'achat</h2>
            <p className="font-body text-f1-white/70 text-sm mb-6">
              Entrez votre email pour recevoir votre billet après le paiement.
            </p>
            <div className="mb-4">
              <label className="block font-body text-f1-white/70 text-sm mb-2">
                Adresse email <span className="text-f1-red">*</span>
              </label>
              <input
                type="email"
                value={buyerEmail}
                onChange={(e) => {
                  setBuyerEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder="votre@email.com"
                className="w-full p-3 rounded-lg bg-f1-carbon text-f1-white font-body border-2 border-f1-asphalt focus:border-f1-red outline-none"
              />
              {emailError && (
                <p className="font-body text-f1-red text-sm mt-1">{emailError}</p>
              )}
            </div>
            <div className="bg-f1-carbon rounded-lg p-3 mb-6">
              <p className="font-body text-f1-white/70 text-sm">
                💳 Des frais de service de <span className="text-f1-white font-bold">5%</span> seront ajoutés au prix du billet.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEmailModal(false);
                  setSelectedTicketId(null);
                  setEmailError(null);
                }}
                className="flex-1 py-3 rounded-lg border-2 border-f1-asphalt font-body text-f1-white/80 hover:bg-f1-asphalt transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handlePurchase}
                disabled={purchaseLoading !== null}
                className="flex-1 py-3 rounded-lg bg-f1-red text-f1-white font-racing font-bold hover:bg-f1-red/90 transition-colors disabled:opacity-50"
              >
                {purchaseLoading ? 'Chargement...' : 'Payer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
