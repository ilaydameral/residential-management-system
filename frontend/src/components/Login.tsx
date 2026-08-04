import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { registerApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

export const Login: React.FC = () => {
  const { login, sessionExpiredMessage, clearSessionMessage } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Login form state
  const [userNameOrEmail, setUserNameOrEmail] = useState('')
  const [password, setPassword] = useState('')

  // Register form state
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regUserName, setRegUserName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')

  // Status & Error messages
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const successMessage = (location.state as { successMessage?: string } | null)?.successMessage
    if (!successMessage) return
    showToast(successMessage)
    navigate('/login', { replace: true, state: null })
  }, [location.state, navigate, showToast])

  const handleTabSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setErrorMessage(null)
    clearSessionMessage()
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userNameOrEmail.trim() || !password) {
      setErrorMessage('Kullanıcı adı/e-posta ve parola alanları zorunludur.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      clearSessionMessage()
      await login({
        userNameOrEmail: userNameOrEmail.trim(),
        password,
      })
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Giriş yapılırken beklenmeyen bir hata oluştu.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (
      !regFirstName.trim() ||
      !regLastName.trim() ||
      !regUserName.trim() ||
      !regEmail.trim() ||
      !regPassword ||
      !regConfirmPassword
    ) {
      setErrorMessage('Lütfen tüm zorunlu alanları doldurunuz.')
      return
    }

    if (regPassword.length < 8) {
      setErrorMessage('Parola en az 8 karakter olmalıdır.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      setErrorMessage('Girdiğiniz parolalar birbiriyle eşleşmiyor.')
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      clearSessionMessage()

      await registerApi({
        firstName: regFirstName.trim(),
        lastName: regLastName.trim(),
        userName: regUserName.trim(),
        email: regEmail.trim(),
        password: regPassword,
      })

      // Registration successful: switch to login mode and pre-fill user name
      showToast('Kayıt oluşturuldu. Hesabınıza giriş yapabilirsiniz.')
      setUserNameOrEmail(regUserName.trim())
      setPassword('')
      setMode('login')

      // Reset register form fields
      setRegFirstName('')
      setRegLastName('')
      setRegUserName('')
      setRegEmail('')
      setRegPassword('')
      setRegConfirmPassword('')
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message)
      } else {
        setErrorMessage('Kayıt olunurken beklenmeyen bir hata oluştu.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Site & Gayrimenkul Yönetimi</h1>
          <p className="auth-subtitle">
            {mode === 'login'
              ? 'Devam etmek için hesabınıza giriş yapın'
              : 'Yeni bir kullanıcı hesabı oluşturun'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('login')}
          >
            Giriş Yap
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => handleTabSwitch('register')}
          >
            Kayıt Ol
          </button>
        </div>

        {!errorMessage && sessionExpiredMessage && (
          <div className="auth-error warning-box">
            <span>{sessionExpiredMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="auth-error">
            <span>{errorMessage}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label" htmlFor="userNameOrEmail">
                Kullanıcı Adı veya E-posta *
              </label>
              <input
                id="userNameOrEmail"
                type="text"
                className="auth-input"
                placeholder="Kullanıcı adı veya e-posta girin"
                value={userNameOrEmail}
                onChange={(e) => setUserNameOrEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="password">
                Parola *
              </label>
              <input
                id="password"
                type="password"
                className="auth-input"
                placeholder="Parolanızı girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="auth-form">
            <div className="auth-row">
              <div className="auth-field">
                <label className="auth-label" htmlFor="regFirstName">
                  Ad *
                </label>
                <input
                  id="regFirstName"
                  type="text"
                  className="auth-input"
                  placeholder="Adınız"
                  value={regFirstName}
                  onChange={(e) => setRegFirstName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="regLastName">
                  Soyad *
                </label>
                <input
                  id="regLastName"
                  type="text"
                  className="auth-input"
                  placeholder="Soyadınız"
                  value={regLastName}
                  onChange={(e) => setRegLastName(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="regUserName">
                Kullanıcı Adı *
              </label>
              <input
                id="regUserName"
                type="text"
                className="auth-input"
                placeholder="Kullanıcı adı belirleyin"
                value={regUserName}
                onChange={(e) => setRegUserName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="regEmail">
                E-posta *
              </label>
              <input
                id="regEmail"
                type="email"
                className="auth-input"
                placeholder="ornek@domain.com"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="regPassword">
                Parola (En az 8 karakter) *
              </label>
              <input
                id="regPassword"
                type="password"
                className="auth-input"
                placeholder="Parolanız"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                disabled={isSubmitting}
                required
                minLength={8}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="regConfirmPassword">
                Parola Tekrar *
              </label>
              <input
                id="regConfirmPassword"
                type="password"
                className="auth-input"
                placeholder="Parolanızı tekrar girin"
                value={regConfirmPassword}
                onChange={(e) => setRegConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Kayıt Olunuyor...' : 'Kayıt Ol'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
