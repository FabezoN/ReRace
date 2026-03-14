import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ProfileService } from '../services/profile.service';
import type { UserRole } from '../services/profile.service';

const navLinkBase =
  'px-4 py-2 rounded font-racing font-bold text-sm uppercase transition-all duration-200 -skew-x-12 border-2 ';
const navLinkActive = 'bg-f1-white text-f1-carbon border-f1-white';
const navLinkInactive = 'text-f1-white/80 border-f1-asphalt hover:border-f1-red hover:text-f1-white hover:bg-f1-red';

export default function Header() {
  const { user, signOut, session } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;
  const [userRole, setUserRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (!session) {
      setUserRole(null);
      return;
    }
    ProfileService.getProfile()
      .then((res) => setUserRole(res.user?.role ?? null))
      .catch(() => setUserRole(null));
  }, [session]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  };

  return (
    <header className="bg-f1-carbon border-b-2 border-f1-asphalt sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center">
            <h1 className="font-racing text-2xl text-f1-white italic">
              Re<span className="text-f1-red">Race</span> 🏁
            </h1>
          </Link>

          <nav className="flex items-center gap-3 flex-wrap justify-end">
            <Link
              to="/races"
              className={`${navLinkBase} ${pathname === '/' || pathname === '/races' || pathname.startsWith('/races/') ? navLinkActive : navLinkInactive}`}
            >
              <span className="inline-block skew-x-12">Courses</span>
            </Link>

            {user && session ? (
              <>
                <Link
                  to="/profile"
                  className={`${navLinkBase} ${pathname === '/profile' ? navLinkActive : navLinkInactive}`}
                >
                  <span className="inline-block skew-x-12">Mon profil</span>
                </Link>
                {userRole !== 'ADMIN' && (
                  <Link
                    to="/sell"
                    className={`${navLinkBase} ${pathname === '/sell' ? navLinkActive : navLinkInactive}`}
                  >
                    <span className="inline-block skew-x-12">+ Vendre un billet</span>
                  </Link>
                )}
                {userRole === 'ADMIN' && (
                  <Link
                    to="/admin"
                    className={`${navLinkBase} ${pathname === '/admin' ? navLinkActive : navLinkInactive}`}
                  >
                    <span className="inline-block skew-x-12">Admin</span>
                  </Link>
                )}
                <div className="flex items-center gap-4 border-l-2 border-f1-asphalt pl-4 ml-1">
                  <div className="text-right hidden md:block">
                    <p className="font-body text-xs text-f1-white/50">Connecté en tant que</p>
                    <p className="font-body text-sm font-semibold text-f1-white">{user.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="font-racing text-xs font-bold px-3 py-2 rounded border-2 border-f1-red text-f1-red hover:bg-f1-red hover:text-f1-white transition-colors -skew-x-12 uppercase"
                  >
                    <span className="inline-block skew-x-12">Se déconnecter</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/auth/login" className={`${navLinkBase} ${navLinkInactive}`}>
                  <span className="inline-block skew-x-12">Connexion</span>
                </Link>
                <Link
                  to="/auth/register"
                  className={`${navLinkBase} ${navLinkActive}`}
                >
                  <span className="inline-block skew-x-12">Inscription</span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
