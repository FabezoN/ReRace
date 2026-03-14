import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SellTicket from '../components/SellTicket';
import { useAuth } from '../contexts/AuthContext';
import { ProfileService } from '../services/profile.service';

export default function SellPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!session) {
      setChecking(false);
      return;
    }
    ProfileService.getProfile()
      .then((res) => {
        if (res.user?.role === 'ADMIN') {
          navigate('/', { replace: true });
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [session, navigate]);

  if (checking) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <p className="text-f1-white/60 font-body">Chargement...</p>
      </div>
    );
  }

  return <SellTicket />;
}
