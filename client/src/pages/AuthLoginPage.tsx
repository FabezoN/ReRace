import { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthLoginPage() {
  const { signIn, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  if (session) {
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signIn(email, password);
      setEmail('');
      setPassword('');
      navigate(from, { replace: true });
    } catch (err: unknown) {
      let errorMessage = 'Une erreur est survenue';
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Invalid login credentials')) {
        errorMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants ou confirmez votre email si vous venez de vous inscrire.';
      } else if (message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre email avant de vous connecter. Vérifiez votre boîte de réception.';
      } else if (message.includes('User already registered')) {
        errorMessage = 'Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.';
      } else if (message.includes('Password')) {
        errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
      } else if (message.includes('email')) {
        errorMessage = "Format d'email invalide.";
      } else {
        errorMessage = message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-16 px-4">
      <div className="bg-f1-asphalt rounded-xl p-8 border-2 border-f1-asphalt hover:border-f1-red/50 transition-colors">
        <h1 className="font-racing text-3xl text-f1-white mb-2 italic uppercase">Connexion</h1>
        <p className="font-body text-f1-white/70 text-sm mb-6">Accédez à votre compte ReRace</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-f1-red/20 border border-f1-red text-f1-white font-body text-sm px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block font-body text-f1-white/80 text-sm font-medium mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-f1-carbon border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white font-body placeholder:text-f1-white/40 focus:outline-none focus:border-f1-red transition-colors"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label className="block font-body text-f1-white/80 text-sm font-medium mb-2">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-f1-carbon border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white font-body placeholder:text-f1-white/40 focus:outline-none focus:border-f1-red transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-f1-white text-f1-carbon font-racing font-bold py-3 px-4 -skew-x-12 hover:bg-f1-red hover:text-f1-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
          >
            <span className="inline-block skew-x-12">{loading ? 'Chargement...' : 'Se connecter'}</span>
          </button>
        </form>

        <p className="mt-6 text-center font-body text-f1-white/60 text-sm">
          Pas encore de compte ?{' '}
          <Link to="/auth/register" className="text-f1-red hover:text-f1-red/80 font-semibold transition-colors">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
