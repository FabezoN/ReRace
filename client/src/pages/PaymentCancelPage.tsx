import { useSearchParams } from 'react-router-dom';
import PaymentCancel from '../components/PaymentCancel';

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const ticketId = searchParams.get('ticket_id');

  return <PaymentCancel ticketId={ticketId} />;
}
