import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PaymentService } from '../services/grand-prix.service';

interface PaymentSuccessProps {
  sessionId: string;
}

interface TicketInfo {
  id: string;
  grandPrixName: string;
  section: string;
  row: string;
  seat: string;
  imageUrl: string | null;
}

export default function PaymentSuccess({ sessionId }: PaymentSuccessProps) {
  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<TicketInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!ticket?.imageUrl) return;
    
    setDownloading(true);
    setDownloadError(null);
    
    try {
      const response = await fetch(ticket.imageUrl);
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      
      const blob = await response.blob();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const extension = contentType.includes('pdf') ? 'pdf' : 
                        contentType.includes('png') ? 'png' : 
                        contentType.includes('webp') ? 'webp' : 'jpg';
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `billet-${ticket.grandPrixName.replace(/\s+/g, '-')}-${ticket.section}-${ticket.seat}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      setDownloadError('Impossible de télécharger le billet. Veuillez réessayer.');
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    PaymentService.verifySession(sessionId)
      .then((result) => {
        if (result.success && result.ticket) {
          setTicket(result.ticket);
        } else {
          setError('Le paiement n\'a pas pu être vérifié');
        }
      })
      .catch(() => setError('Erreur lors de la vérification du paiement'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#FF1801] mx-auto mb-4"></div>
          <p className="text-white text-lg">Vérification du paiement...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="bg-[#2D2D3A] rounded-xl p-8 max-w-md text-center border border-red-500">
          <div className="text-red-500 text-6xl mb-4">✗</div>
          <h1 className="text-2xl font-bold text-white mb-4">Erreur</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link to="/" className="inline-block bg-white text-black font-bold py-3 px-6 rounded-lg hover:bg-gray-200 transition-colors">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="bg-[#2D2D3A] rounded-xl p-8 max-w-lg w-full border border-green-500">
        <div className="text-center mb-6">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold text-white italic">PAIEMENT RÉUSSI !</h1>
          <p className="text-gray-400 mt-2">Votre billet a été acheté avec succès</p>
        </div>

        {ticket && (
          <div className="bg-[#15151E] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">{ticket.grandPrixName}</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Tribune / Gradin</span>
                <span className="text-white font-medium">{ticket.section}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rangée</span>
                <span className="text-white font-medium">{ticket.row}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Place</span>
                <span className="text-white font-medium">{ticket.seat}</span>
              </div>
            </div>

            {ticket.imageUrl ? (
              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-gray-400 text-sm mb-3">Téléchargez votre billet :</p>
                {downloadError && <p className="text-red-400 text-sm mb-3">{downloadError}</p>}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="block w-full bg-[#FF1801] text-white font-bold py-3 rounded-lg text-center hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {downloading ? '⏳ Téléchargement...' : '📥 Télécharger mon billet'}
                </button>
              </div>
            ) : (
              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-yellow-500 text-sm">⚠️ Aucune image de billet disponible.</p>
              </div>
            )}
          </div>
        )}

        <Link to="/" className="block w-full text-center bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors">
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
