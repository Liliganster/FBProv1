import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import useLoginTranslation from '../hooks/useLoginTranslation';
import { AtSignIcon, KeyRoundIcon, LoaderIcon } from './Icons';

const LoginView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, signInWithOAuth } = useAuth();
  const { t } = useLoginTranslation();

  // Reset form state on mount to prevent duplicate state
  React.useEffect(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setLoading(false);
    setIsLogin(true);
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithOAuth('google');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      try {
        await login(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } else {
      if (password !== confirmPassword) {
        setError(t('login_password_mismatch'));
        setLoading(false);
        return;
      }
      try {
        await register(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen relative overflow-hidden">
      {/* Background image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'url(/images/urbanbuzz_image_of_a_tv_camera_setup_in_a_white_background_the__188e8b3b-4b30-41b8-bb2a-927e4cb4d0ef.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* Dark overlay only on background */}
      <div className="absolute inset-0 z-10 bg-gradient-to-br from-black/60 via-black/40 to-black/60" />
      
      {/* Login form */}
      <div className="w-full max-w-md p-8 space-y-8 bg-gradient-glass backdrop-blur-glass rounded-organic shadow-glass border-glass relative z-20">
        <div className="text-center">
          <div className="mb-6">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-brand-primary bg-clip-text text-transparent mb-2 tracking-wide">Fahrtenbuch Pro</h1>
            <p className="text-sm text-on-surface-secondary font-light tracking-widest">PROFESSIONAL LOGBOOK</p>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-white">
            {isLogin ? t('login_title') : t('register_title')}
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="relative">
            <label htmlFor="email-address" className="sr-only">
              {t('login_email_placeholder')}
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <AtSignIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
            </div>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-label={t('login_email_placeholder')}
              className="w-full bg-gradient-surface border-surface rounded-smooth py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:outline-none text-white placeholder-on-surface-secondary transition-all duration-200"
              placeholder={t('login_email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="sr-only">
              {t('login_password_placeholder')}
            </label>
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRoundIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              aria-label={t('login_password_placeholder')}
              className="w-full bg-gradient-surface border-surface rounded-smooth py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:outline-none text-white placeholder-on-surface-secondary transition-all duration-200"
              placeholder={t('login_password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {!isLogin && (
            <div className="relative">
              <label htmlFor="confirm-password" className="sr-only">
                {t('register_confirm_password_placeholder')}
              </label>
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <KeyRoundIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </div>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                aria-label={t('register_confirm_password_placeholder')}
                className="w-full bg-gradient-surface border-surface rounded-smooth py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:border-brand-primary focus:outline-none text-white placeholder-on-surface-secondary transition-all duration-200"
                placeholder={t('register_confirm_password_placeholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}
          {error && <p className="text-error-dark text-sm text-center bg-red-900/20 border border-red-500/20 rounded-smooth px-3 py-2">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              aria-label={isLogin ? t('login_btn') : t('register_btn')}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-smooth text-white bg-gradient-brand hover:shadow-brand hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-dark disabled:opacity-50 disabled:hover:scale-100 transition-all duration-200"
            >
              {loading && <LoaderIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true"/>}
              {isLogin ? t('login_btn') : t('register_btn')}
            </button>
          </div>
        </form>

        <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-600" />
            <span className="mx-4 text-sm text-gray-400">{t('login_or_continue_with')}</span>
            <hr className="flex-grow border-gray-600" />
        </div>
        
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          aria-label={t('login_continue_google')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border-surface rounded-smooth text-sm font-medium text-white bg-gradient-surface hover:bg-gradient-to-r hover:from-surface-medium hover:to-surface-light hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 focus:ring-offset-surface-dark disabled:opacity-50 transition-all duration-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? (
            <>
              <LoaderIcon className="w-5 h-5 animate-spin" aria-hidden="true" />
              {t('login_signing_in')}
            </>
          ) : (
            t('login_continue_google')
          )}
        </button>

        <div className="text-sm text-center">
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            aria-label={isLogin ? t('login_switch_to_register') : t('register_switch_to_login')}
            className="font-medium text-brand-primary hover:text-white transition-colors duration-200"
          >
            {isLogin ? t('login_switch_to_register') : t('register_switch_to_login')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginView;