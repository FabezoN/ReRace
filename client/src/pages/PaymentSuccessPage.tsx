import { useSearchParams, Link } from 'react-router-dom';
import PaymentSuccess from '../components/PaymentSuccess';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <div className="bg-[#2D2D3A] rounded-xl p-8 max-w-md text-center border border-red-500">
          <p className="text-white">Session de paiement invalide.</p>
          <Link to="/" className="inline-block mt-4 text-[#FF1801] hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  return <PaymentSuccess sessionId={sessionId} />;
}
