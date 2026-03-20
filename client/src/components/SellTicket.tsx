import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrandPrixService, TicketService } from '../services/grand-prix.service';
import type { GrandPrix } from '../services/grand-prix.service';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';

export default function SellTicket() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [races, setRaces] = useState<GrandPrix[]>([]);
  const [formData, setFormData] = useState({
    grandPrixId: '',
    section: '',
    row: '',
    seat: '',
    price: '',
    imageUrl: ''
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    GrandPrixService.getAll().then(setRaces).catch((err) => {
      console.error('Erreur chargement GP:', err);
    });
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setError(null);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Sélectionnez une image');
      }

      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Le fichier est trop volumineux (max 5MB)');
      }
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Format non supporté. Utilisez JPG, PNG, WebP ou PDF.');
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('tickets')
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erreur upload Supabase:', uploadError);
        throw uploadError;
      }
      const { data } = supabase.storage.from('tickets').getPublicUrl(fileName);
      setFormData({ ...formData, imageUrl: data.publicUrl });
      
    } catch (error: any) {
      console.error('❌ Erreur handleFileUpload:', error);
      setError('Erreur upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!formData.imageUrl) {
      setError('Veuillez sélectionner une pièce jointe (justificatif du billet)');
      setLoading(false);
      return;
    }

    try {
      await TicketService.create({
        grandPrixId: formData.grandPrixId,
        section: formData.section,
        row: formData.row,
        seat: formData.seat,
        price: Number(formData.price),
        imageUrl: formData.imageUrl,
      });
      showToast('Billet mis en vente avec succès !', 'success');
      navigate('/');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || "Erreur lors de la vente. Vérifiez que tous les champs sont remplis.";
      setError(errorMessage);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10 p-8 bg-[#2D2D3A] rounded-xl shadow-lg border border-gray-700">
      <h2 className="text-3xl font-bold text-white mb-6 italic">VENDRE UN BILLET</h2>
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-400 mb-2">Grand Prix</label>
          <select 
            className="w-full p-3 rounded bg-[#15151E] text-white border border-gray-600 focus:border-[#FF1801] outline-none"
            value={formData.grandPrixId}
            onChange={(e) => setFormData({...formData, grandPrixId: e.target.value})}
            required
          >
            <option value="">Choisir une course...</option>
            {races
              .filter(gp => new Date(gp.date) >= new Date())
              .map(gp => (
                <option key={gp.id} value={gp.id}>{gp.name} ({new Date(gp.date).toLocaleDateString('fr-FR')})</option>
              ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-gray-400 mb-2">Tribune / Section</label>
            <input 
              type="text" placeholder="Ex: Gold A"
              className="w-full p-3 rounded bg-[#15151E] text-white border border-gray-600 focus:border-[#FF1801] outline-none"
              value={formData.section}
              onChange={(e) => setFormData({...formData, section: e.target.value})}
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Rang</label>
            <input 
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Ex: 12"
              className="w-full p-3 rounded bg-[#15151E] text-white border border-gray-600 focus:border-[#FF1801] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={formData.row}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d+$/.test(v)) setFormData({ ...formData, row: v });
              }}
              required
            />
          </div>
          <div>
            <label className="block text-gray-400 mb-2">Siège</label>
            <input 
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder="Ex: 42"
              className="w-full p-3 rounded bg-[#15151E] text-white border border-gray-600 focus:border-[#FF1801] outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              value={formData.seat}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d+$/.test(v)) setFormData({ ...formData, seat: v });
              }}
              required
            />
          </div>
        </div>
        <div>
          <label className="block text-gray-400 mb-2">Prix de vente (€)</label>
          <input 
            type="number" min="1" step="0.01" placeholder="0.00"
            className="w-full p-3 rounded bg-[#15151E] text-white border border-gray-600 focus:border-[#FF1801] outline-none text-xl font-bold"
            value={formData.price}
            onChange={(e) => setFormData({...formData, price: e.target.value})}
            required
          />
        </div>
        <div>
          <label className="block text-gray-400 mb-2">
            Photo de la vue (justificatif du billet) <span className="text-red-500">*</span>
          </label>
          <input 
            type="file" 
            accept="image/*, application/pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="w-full p-3 rounded bg-[#15151E] text-white border border-gray-600 focus:border-[#FF1801] outline-none file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-[#FF1801] file:text-white hover:file:bg-red-700"
            required
          />
          {uploading && <p className="text-yellow-500 text-sm mt-1">Envoi en cours...</p>}
          {formData.imageUrl && !uploading && (
            <p className="text-green-500 text-sm mt-1">✅ Fichier chargé</p>
          )}
        </div>
        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-[#FF1801] text-white font-bold py-4 rounded hover:bg-red-700 transition disabled:opacity-50 mt-4"
        >
          {loading ? 'Création en cours...' : 'METTRE EN VENTE'}
        </button>
      </form>
    </div>
  );
}
