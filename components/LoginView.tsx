import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import useTranslation from '../hooks/useTranslation';
import { AtSignIcon, KeyRoundIcon, LoaderIcon } from './Icons';

declare global {
  interface Window {
    google: any;
  }
}

const LoginView: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle, googleClientId } = useAuth();
  const { t } = useTranslation();
  const renderIntervalRef = useRef<number | null>(null);

  const handleGoogleSignIn = React.useCallback(async (response: any) => {
    setLoading(true);
    try {
        if(loginWithGoogle) {
          await loginWithGoogle(response.credential);
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
    } finally {
        setLoading(false);
    }
  }, [loginWithGoogle]);

  useEffect(() => {
    if (!googleClientId) {
      return;
    }

    const renderGoogleButton = () => {
      const buttonContainer = document.getElementById('googleSignInButtonContainer');
      // If GSI script is loaded and button container is in the DOM
      if (window.google?.accounts?.id && buttonContainer) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            callback: handleGoogleSignIn,
          });
          window.google.accounts.id.renderButton(
            buttonContainer,
            { theme: 'outline', size: 'large', type: 'standard', text: 'signin_with', shape: 'rectangular' }
          );
          // Once rendered, clear the interval
          if (renderIntervalRef.current) {
            clearInterval(renderIntervalRef.current);
            renderIntervalRef.current = null;
          }
        } catch (e) {
          console.error("Error initializing Google Sign-In", e);
          setError("Could not initialize Google Sign-In.");
          if (renderIntervalRef.current) {
            clearInterval(renderIntervalRef.current);
            renderIntervalRef.current = null;
          }
        }
      }
    };

    // If script is already available, render immediately.
    // Otherwise, set an interval to poll for the script.
    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else {
      renderIntervalRef.current = window.setInterval(renderGoogleButton, 200);
    }

    // Cleanup interval on component unmount
    return () => {
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current);
      }
    };
  }, [googleClientId, handleGoogleSignIn]);


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
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <AtSignIcon className="h-5 w-5 text-gray-500" />
            </div>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full bg-background-dark border border-gray-600 rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
              placeholder={t('login_email_placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <KeyRoundIcon className="h-5 w-5 text-gray-500" />
            </div>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              className="w-full bg-background-dark border border-gray-600 rounded-lg py-3 pl-10 pr-4 focus:ring-2 focus:ring-brand-primary focus:outline-none text-on-surface-dark"
              placeholder={t('login_password_placeholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {!isLogin && (
            <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <KeyRoundIcon className="h-5 w-5 text-gray-500" />
                </div>
              <input
                id="confirm-password"
                name="confirm-password"
                type="password"
                autoComplete="new-password"
                required
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
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-brand-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background-dark focus:ring-brand-primary disabled:opacity-50"
            >
              {loading && <LoaderIcon className="w-5 h-5 mr-2 animate-spin"/>}
              {isLogin ? t('login_btn') : t('register_btn')}
            </button>
          </div>
        </form>

        <div className="flex items-center my-6">
            <hr className="flex-grow border-gray-600" />
            <span className="mx-4 text-sm text-on-surface-dark-secondary">{t('login_or_continue_with')}</span>
            <hr className="flex-grow border-gray-600" />
        </div>
        <div id="googleSignInButtonContainer"></div>

        <div className="text-sm text-center">
          <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-medium text-brand-primary hover:text-blue-400">
            {isLogin ? t('login_switch_to_register') : t('register_switch_to_login')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginView;