import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PaymentService } from '../services/grand-prix.service';

interface PaymentCancelProps {
  ticketId: string | null;
}

export default function PaymentCancel({ ticketId }: PaymentCancelProps) {
  useEffect(() => {
    if (ticketId) {
      PaymentService.cancelPurchase(ticketId).catch(console.error);
    }
  }, [ticketId]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="bg-[#2D2D3A] rounded-xl p-8 max-w-md text-center border border-gray-700">
        <div className="text-yellow-500 text-6xl mb-4">⚠️</div>
        
        <h1 className="text-2xl font-bold text-white mb-4">Paiement annulé</h1>
        
        <p className="text-gray-400 mb-6">
          Votre paiement a été annulé. Le billet a été remis en vente.
        </p>
        
        <p className="text-gray-500 text-sm mb-6">
          Vous pouvez retenter l'achat à tout moment.
        </p>

        <Link
          to="/"
          className="block w-full text-center bg-white text-black font-bold py-3 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
