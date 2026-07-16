import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function AuthRegisterPage() {
  const { signUp, session } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signUp(email, password);
      if (result.user) {
        showToast('Inscription réussie !', 'success');
        setEmail('');
        setPassword('');
        navigate('/auth/login', { replace: true });
      }
    } catch (err: unknown) {
      let errorMessage = 'Une erreur est survenue';
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Invalid login credentials')) {
        errorMessage = 'Email ou mot de passe incorrect.';
      } else if (message.includes('Email not confirmed')) {
        errorMessage = 'Veuillez confirmer votre email.';
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
        <h1 className="font-racing text-3xl text-f1-white mb-2 italic uppercase">Inscription</h1>
        <p className="font-body text-f1-white/70 text-sm mb-6">Créez votre compte ReRace</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div role="alert" id="register-error" className="bg-f1-red/20 border border-f1-red text-f1-white font-body text-sm px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="register-email" className="block font-body text-f1-white/80 text-sm font-medium mb-2">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={!!error}
              aria-describedby={error ? 'register-error' : undefined}
              className="w-full bg-f1-carbon border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white font-body placeholder:text-f1-white/40 focus:outline-none focus:border-f1-red transition-colors"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block font-body text-f1-white/80 text-sm font-medium mb-2">Mot de passe</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              aria-invalid={!!error}
              aria-describedby={error ? 'register-error' : undefined}
              className="w-full bg-f1-carbon border-2 border-f1-asphalt rounded px-4 py-3 text-f1-white font-body placeholder:text-f1-white/40 focus:outline-none focus:border-f1-red transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-f1-white text-f1-carbon font-racing font-bold py-3 px-4 -skew-x-12 hover:bg-f1-red hover:text-f1-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm"
          >
            <span className="inline-block skew-x-12">{loading ? 'Chargement...' : "S'inscrire"}</span>
          </button>
        </form>

        <p className="mt-6 text-center font-body text-f1-white/60 text-sm">
          Déjà un compte ?{' '}
          <Link to="/auth/login" className="text-f1-red hover:text-f1-red/80 font-semibold transition-colors">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
