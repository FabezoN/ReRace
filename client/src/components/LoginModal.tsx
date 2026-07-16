import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LoginModalProps {
  onClose: () => void;
}

export default function LoginModal({ onClose }: LoginModalProps) {
  const { signIn, signUp } = useAuth();
  const { showToast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signIn(email, password);
        onClose();
        setEmail('');
        setPassword('');
      } else {
        const result = await signUp(email, password);
        if (result.user) {
          showToast('Inscription réussie !', 'success');
          onClose();
          setEmail('');
          setPassword('');
        }
      }
    } catch (err: any) {
      console.error('Erreur complète:', err);
      
      let errorMessage = 'Une erreur est survenue';
      
      if (err.message) {
        if (err.message.includes('Invalid login credentials')) {
          errorMessage = 'Email ou mot de passe incorrect. Vérifiez vos identifiants ou confirmez votre email si vous venez de vous inscrire.';
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Veuillez confirmer votre email avant de vous connecter. Vérifiez votre boîte de réception.';
        } else if (err.message.includes('User already registered')) {
          errorMessage = 'Cet email est déjà utilisé. Connectez-vous ou utilisez un autre email.';
        } else if (err.message.includes('Password')) {
          errorMessage = 'Le mot de passe doit contenir au moins 6 caractères.';
        } else if (err.message.includes('email')) {
          errorMessage = 'Format d\'email invalide.';
        } else {
          errorMessage = err.message;
        }
      } else if (err.error_description) {
        errorMessage = err.error_description;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#2D2D3A] rounded-xl p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isLogin ? 'Connexion' : 'Inscription'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" id="modal-error" className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="modal-email" className="block text-gray-300 text-sm font-medium mb-2">
              Email
            </label>
            <input
              id="modal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-invalid={!!error}
              aria-describedby={error ? 'modal-error' : undefined}
              className="w-full bg-[#1A1A24] border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-[#FF1801]"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-gray-300 text-sm font-medium mb-2">
              Mot de passe
            </label>
            <input
              id="modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              aria-invalid={!!error}
              aria-describedby={error ? 'modal-error' : undefined}
              className="w-full bg-[#1A1A24] border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-[#FF1801]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#FF1801] text-white py-2 rounded font-semibold hover:bg-[#cc1201] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : "S'inscrire"}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            className="text-gray-400 hover:text-white text-sm"
          >
            {isLogin
              ? "Pas encore de compte ? S'inscrire"
              : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
}
