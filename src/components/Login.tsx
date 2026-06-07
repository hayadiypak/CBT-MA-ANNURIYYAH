import { useState, FormEvent } from 'react';
import { LogIn, KeyRound, User, Users, GraduationCap, AlertCircle, Sparkles } from 'lucide-react';
import { Student, Teacher } from '../types';
// @ts-ignore
import logoImg from '../assets/images/ma_logo_clean_1780675707006.png';

interface LoginProps {
  onLoginAttempt: (
    role: 'student' | 'teacher',
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string; user?: any }>;
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginAttempt, onLoginSuccess }: LoginProps) {
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      setError('Username Dan Password wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await onLoginAttempt(role, cleanUsername, cleanPassword);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'Terjadi kesalahan saat masuk. Silakan coba lagi.');
      }
    } catch (err) {
      setError('Gagal menghubungkan ke server. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-6 relative overflow-hidden">
      {/* Decorative Islamic Star Pattern Background / Subtle Shapes */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-5">
        <div className="absolute top-10 left-10 w-96 h-96 rounded-full bg-emerald-600 blur-3xl"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-amber-500 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8 z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="relative inline-flex items-center justify-center w-24 h-24 mb-4 rounded-full border-[3px] border-emerald-600 shadow-lg shadow-emerald-700/10 hover:scale-105 transition-transform duration-300 overflow-hidden bg-white">
            <img 
              src={logoImg} 
              alt="Logo MA Annuriyyah" 
              className="w-full h-full object-cover rounded-full z-10"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold font-sans text-gray-900 tracking-tight">
            CBT MA Annuriyyah
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-sans">
            Aplikasi Masih Proses Pengembangan
          </p>
        </div>

        {/* Tab Role Switcher */}
        <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl mb-6">
          <button
            type="button"
            onClick={() => {
              setRole('student');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              role === 'student'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4" />
            Siswa (Student)
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('teacher');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              role === 'teacher'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" />
            Guru / Admin
          </button>
        </div>

        {/* Alert Error */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl mb-6 text-xs text-red-650">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Username atau NISN
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                placeholder={role === 'student' ? 'Masukkan Username atau NISN' : 'Masukkan Username Admin/Guru'}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-gray-400">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder="••••••"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all font-sans disabled:opacity-60 disabled:bg-gray-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-emerald-600/10 hover:shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-80 disabled:cursor-wait"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Memproses Masuk...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Masuk Aplikasi</span>
              </>
            )}
          </button>
        </form>

        {/* Informative Footer Box for CBT Simulation */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
          <div className="inline-flex items-center gap-1.5 p-2 px-3 bg-amber-50 border border-amber-100 text-[11px] text-amber-800 rounded-xl leading-relaxed">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>
              <strong>Info Akun Demo:</strong> Siswa: <code className="bg-amber-100 px-1 rounded font-bold">Janur</code> / <code className="bg-amber-100 px-1 rounded">123</code> | Admin: <code className="bg-amber-100 px-1 rounded font-bold">Aedia</code> / <code className="bg-amber-100 px-1 rounded">aedia</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
