import { useParams } from 'react-router-dom';
import TicketList from '../components/TicketList';

export default function RaceTicketsPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return (
      <div className="text-white text-center p-10">
        Grand Prix introuvable.
      </div>
    );
  }

  return <TicketList grandPrixId={id} />;
}
