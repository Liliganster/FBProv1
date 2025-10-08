import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import useTranslation from '../hooks/useTranslation';
import { AtSignIcon, KeyRoundIcon, LoaderIcon } from './Icons';

const LoginView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, signInWithOAuth } = useAuth();
  const { t } = useTranslation();

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
    <div className="flex items-center justify-center min-h-screen bg-background-dark">
      <div className="w-full max-w-md p-8 space-y-8 bg-surface-dark rounded-xl shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Fahrtenbuch Pro</h1>
          <h2 className="mt-2 text-xl font-semibold text-on-surface-dark">
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
              className="w-full bg-background-dark border border-gray-600 rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
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
              className="w-full bg-background-dark border border-gray-600 rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
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
                className="w-full bg-background-dark border border-gray-600 rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
                placeholder={t('register_confirm_password_placeholder')}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={loading}
              aria-label={isLogin ? t('login_btn') : t('register_btn')}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-brand-primary disabled:opacity-50"
            >
              {loading && <LoaderIcon className="w-5 h-5 mr-2 animate-spin" aria-hidden="true"/>}
              {isLogin ? t('login_btn') : t('register_btn')}
            </button>
          </div>
        </form>

        <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-600" />
            <span className="mx-4 text-sm text-on-surface-dark-secondary">{t('login_or_continue_with')}</span>
            <hr className="flex-grow border-gray-600" />
        </div>
        
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          aria-label={t('login_continue_google')}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-600 rounded-lg text-sm font-medium text-white bg-surface-dark hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-brand-primary disabled:opacity-50 transition-colors"
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
            className="font-medium text-brand-primary hover:text-blue-400"
          >
            {isLogin ? t('login_switch_to_register') : t('register_switch_to_login')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginView;