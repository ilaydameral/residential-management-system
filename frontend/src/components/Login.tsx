import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { registerApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { KineticGrid } from './KineticGrid'

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export const Login: React.FC = () => {
  const { login, sessionExpiredMessage, clearSessionMessage } = useAuth()
  const { showToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Section Refs & Visibility State for Bulletproof Staggered Reveal
  const featuresRef = useRef<HTMLElement>(null)
  const rolesRef = useRef<HTMLElement>(null)
  const howItWorksRef = useRef<HTMLElement>(null)
  const ctaRef = useRef<HTMLElement>(null)

  const [featuresVisible, setFeaturesVisible] = useState(false)
  const [rolesVisible, setRolesVisible] = useState(false)
  const [howItWorksVisible, setHowItWorksVisible] = useState(false)
  const [ctaVisible, setCtaVisible] = useState(false)

  // Login form state
  const [userNameOrEmail, setUserNameOrEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Register form state
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regUserName, setRegUserName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false)

  // Status & Error messages
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    const successMessage = (location.state as { successMessage?: string } | null)?.successMessage
    if (!successMessage) return
    showToast(successMessage)
    navigate('/login', { replace: true, state: null })
  }, [location.state, navigate, showToast])

  // ESC Key listener to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDrawerOpen])

  // Staggered scroll reveal observer with React Refs and Fail-safe
  useEffect(() => {
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setFeaturesVisible(true)
      setRolesVisible(true)
      setHowItWorksVisible(true)
      setCtaVisible(true)
      return
    }

    const sections = [
      { ref: featuresRef, setVisible: setFeaturesVisible },
      { ref: rolesRef, setVisible: setRolesVisible },
      { ref: howItWorksRef, setVisible: setHowItWorksVisible },
      { ref: ctaRef, setVisible: setCtaVisible },
    ]

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const matched = sections.find((s) => s.ref.current === entry.target)
            if (matched) {
              matched.setVisible(true)
              obs.unobserve(entry.target)
            }
          }
        })
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    )

    sections.forEach(({ ref }) => {
      if (ref.current) observer.observe(ref.current)
    })

    return () => observer.disconnect()
  }, [])

  // Active Section tracking state for Navbar Scrollspy
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Scrollspy observer for Navbar active link tracking (independent from reveal animations)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    const handleScroll = () => {
      if (window.scrollY < 260) {
        setActiveSection(null)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    const spySections = ['features', 'roles', 'how-it-works']

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && window.scrollY >= 260) {
            setActiveSection(entry.target.id)
          }
        })
      },
      {
        rootMargin: '-25% 0px -45% 0px',
        threshold: 0.1,
      }
    )

    spySections.forEach((id) => {
      const el = document.getElementById(id)
      if (el) spyObserver.observe(el)
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      spyObserver.disconnect()
    }
  }, [])

  const openDrawer = (initialMode: 'login' | 'register' = 'login') => {
    setMode(initialMode)
    setErrorMessage(null)
    clearSessionMessage()
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
  }

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

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

      showToast('Kayıt oluşturuldu. Hesabınıza giriş yapabilirsiniz.')
      setUserNameOrEmail(regUserName.trim())
      setPassword('')
      setMode('login')

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
    <div className="landing-page">
      {/* GLASSMOPHIC TOP NAVBAR */}
      <nav className="landing-navbar">
        <div className="landing-nav-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="landing-brand-logo">SY</div>
          <span>Site Yönetimi</span>
        </div>

        <div className="landing-nav-links">
          <button
            className={`landing-nav-link ${activeSection === 'features' ? 'active' : ''}`}
            onClick={() => scrollToSection('features')}
          >
            Özellikler
          </button>
          <button
            className={`landing-nav-link ${activeSection === 'roles' ? 'active' : ''}`}
            onClick={() => scrollToSection('roles')}
          >
            Roller
          </button>
          <button
            className={`landing-nav-link ${activeSection === 'how-it-works' ? 'active' : ''}`}
            onClick={() => scrollToSection('how-it-works')}
          >
            Nasıl Çalışır?
          </button>
        </div>

        <div className="landing-nav-actions">
          <button className="landing-btn-text" onClick={() => openDrawer('login')}>
            Giriş Yap
          </button>
          <button className="landing-btn-primary" onClick={() => openDrawer('register')}>
            Kayıt Ol
          </button>
        </div>
      </nav>

      {/* FULL VIEWPORT KINETIC HERO */}
      <section className="landing-hero">
        <KineticGrid className="landing-hero-grid">
          <div className="landing-hero-container">
            <div className="landing-hero-eyebrow">
              <span>🏢 SITE YÖNETİMİ · RESIDENTIAL MANAGEMENT</span>
            </div>

            <h1 className="landing-hero-headline">
              Yaşam alanınızı <br />
              tek yerden yönetin.
            </h1>

            <p className="landing-hero-description">
              Aidatlar, giderler, ödeme bildirimleri ve site yönetimi tek platformda. Sakinler ve yönetim arasındaki tüm süreçleri kolaylaştırın.
            </p>

            <div className="landing-hero-cta-group">
              <button className="landing-btn-hero-primary" onClick={() => openDrawer('login')}>
                Giriş Yap
              </button>
              <button className="landing-btn-hero-secondary" onClick={() => openDrawer('register')}>
                Kayıt Ol
              </button>
            </div>

            <button className="landing-scroll-more" onClick={() => scrollToSection('features')}>
              <span>Daha Fazla Bilgi</span>
              <span>↓</span>
            </button>
          </div>
        </KineticGrid>
      </section>

      {/* SECTION 1: FEATURES (Typography-first whitespace design) */}
      <section ref={featuresRef} id="features" className={`landing-section reveal-group ${featuresVisible ? 'is-visible' : ''}`}>
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-section-label reveal-item" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
              Özellikler
            </span>
            <h2 className="landing-section-title reveal-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              Her şeyi tek merkezden yönetin.
            </h2>
            <p className="landing-section-subtitle reveal-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
              Karmaşık Excel tabloları yerine şeffaf ve güvenilir dijital yönetim altyapısı.
            </p>
          </div>

          <div className="landing-features-grid">
            <div className="landing-feature-col reveal-item" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
              <div className="landing-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </div>
              <h3 className="landing-feature-title">Aidat ve Borç Takibi</h3>
              <p className="landing-feature-text">
                Daire bazlı aidat, gider payı ve özel borçlandırma geçmişini detaylı dökümlerle şeffaf şekilde takip edin.
              </p>
            </div>

            <div className="landing-feature-col reveal-item" style={{ '--reveal-delay': '410ms' } as React.CSSProperties}>
              <div className="landing-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </div>
              <h3 className="landing-feature-title">Gider ve Borçlandırma Yönetimi</h3>
              <p className="landing-feature-text">
                Ortak alan harcamalarını ve tesis giderlerini dairelere eşit veya özel katsayı oranlarıyla otomatik borçlandırın.
              </p>
            </div>

            <div className="landing-feature-col reveal-item" style={{ '--reveal-delay': '520ms' } as React.CSSProperties}>
              <div className="landing-feature-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              <h3 className="landing-feature-title">Dekont ile Ödeme Bildirimi</h3>
              <p className="landing-feature-text">
                Sakinlerin yüklediği banka dekontlarını ön izleme aracıyla inceleyin, anında onaylayın veya iptal edin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: ROLES BREAKDOWN */}
      <section ref={rolesRef} id="roles" className={`landing-section landing-section-alt reveal-group ${rolesVisible ? 'is-visible' : ''}`}>
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-section-label reveal-item" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
              Kullanıcı Rolleri
            </span>
            <h2 className="landing-section-title reveal-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              Yönetici ve sakin için ayrı deneyim.
            </h2>
            <p className="landing-section-subtitle reveal-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
              Her rolün ihtiyacına özel sadeleştirilmiş arayüz ve yetkilendirme modelleri.
            </p>
          </div>

          <div className="landing-roles-grid">
            <div className="landing-role-box reveal-item" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
              <span className="landing-role-badge landing-role-badge-mgmt">Yönetim Paneli</span>
              <h3 className="landing-role-title">Site Yöneticisi</h3>
              <ul className="landing-role-list">
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Finansal genel bakış ve toplam alacak raporlama özetleri</span>
                </li>
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Aidat, gider ve daire bazlı borçlandırma tanımları</span>
                </li>
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Gelen ödeme bildirimlerini ve dekont dosyalarını onaylama/reddetme</span>
                </li>
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Site, bina, daire ve sakin kayıtlarını yönetme</span>
                </li>
              </ul>
            </div>

            <div className="landing-role-box reveal-item" style={{ '--reveal-delay': '430ms' } as React.CSSProperties}>
              <span className="landing-role-badge landing-role-badge-resident">Sakin Portalı</span>
              <h3 className="landing-role-title">Site Sakini</h3>
              <ul className="landing-role-list">
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Kendi dairelerine ait borç ve aidat durumunu görüntüleme</span>
                </li>
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Banka transferi sonrası dekont yükleyerek ödeme bildirimi yapma</span>
                </li>
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Gönderilen ödeme bildirimlerinin inceleme ve onay durumunu takip etme</span>
                </li>
                <li className="landing-role-item">
                  <span className="landing-role-item-icon">✓</span>
                  <span>Geçmiş ödeme hareketlerini şeffaf şekilde listeleme</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: HOW IT WORKS */}
      <section ref={howItWorksRef} id="how-it-works" className={`landing-section reveal-group ${howItWorksVisible ? 'is-visible' : ''}`}>
        <div className="landing-container">
          <div className="landing-section-header">
            <span className="landing-section-label reveal-item" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
              İş Akışı
            </span>
            <h2 className="landing-section-title reveal-item" style={{ '--reveal-delay': '100ms' } as React.CSSProperties}>
              Nasıl çalışır?
            </h2>
            <p className="landing-section-subtitle reveal-item" style={{ '--reveal-delay': '200ms' } as React.CSSProperties}>
              3 adımda tamamlanan uçtan uca ödeme ve onay süreci.
            </p>
          </div>

          <div className="landing-steps-grid">
            <div className="landing-step-col reveal-item" style={{ '--reveal-delay': '300ms' } as React.CSSProperties}>
              <div className="landing-step-number">1</div>
              <h3 className="landing-step-title">Borç Oluşturulur</h3>
              <p className="landing-step-text">
                Yönetici aidat veya gider payı borçlandırmasını ilgili daire hesaplarına tanımlar.
              </p>
            </div>

            <div className="landing-step-col reveal-item" style={{ '--reveal-delay': '410ms' } as React.CSSProperties}>
              <div className="landing-step-number">2</div>
              <h3 className="landing-step-title">Sakin Ödeme Bildirir</h3>
              <p className="landing-step-text">
                Sakin ödemeyi tamamladıktan sonra banka dekontunu yükleyerek bildirim oluşturur.
              </p>
            </div>

            <div className="landing-step-col reveal-item" style={{ '--reveal-delay': '520ms' } as React.CSSProperties}>
              <div className="landing-step-number">3</div>
              <h3 className="landing-step-title">Yönetici Onaylar</h3>
              <p className="landing-step-text">
                Yönetici dekontu inceler, tutar ve hesabı doğrulayarak borcu kapatır.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section ref={ctaRef} className={`landing-cta-section reveal-group ${ctaVisible ? 'is-visible' : ''}`}>
        <div className="landing-cta-container">
          <h2 className="landing-cta-title reveal-item" style={{ '--reveal-delay': '0ms' } as React.CSSProperties}>
            Site yönetimini daha düzenli hale getirin.
          </h2>
          <p className="landing-cta-text reveal-item" style={{ '--reveal-delay': '110ms' } as React.CSSProperties}>
            Sakinler ve yönetim arasındaki tüm finansal süreçleri tek platformda buluşturun.
          </p>
          <div className="landing-hero-cta-group reveal-item" style={{ '--reveal-delay': '220ms', justifyContent: 'center', marginBottom: 0 } as React.CSSProperties}>
            <button className="landing-btn-hero-primary" onClick={() => openDrawer('login')}>
              Giriş Yap
            </button>
            <button className="landing-btn-hero-secondary" onClick={() => openDrawer('register')}>
              Kayıt Ol
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <p>© 2026 Site Yönetimi · Residential Management System. Tüm hakları saklıdır.</p>
      </footer>

      {/* SLIDE-OVER AUTH DRAWER PANEL */}
      <div
        className={`auth-drawer-overlay ${isDrawerOpen ? 'is-open' : ''}`}
        onClick={closeDrawer}
        aria-hidden={!isDrawerOpen}
      >
        <div
          className="auth-drawer-panel"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Kullanıcı Girişi ve Kayıt"
        >
          {/* Drawer Header */}
          <div className="auth-drawer-header">
            <div className="auth-surface-brand" style={{ marginBottom: 0 }}>
              <div className="auth-surface-badge">SY</div>
              <div className="auth-surface-info">
                <strong>Site Yönetimi</strong>
                <span>{mode === 'login' ? 'Giriş Yapın' : 'Kayıt Oluşturun'}</span>
              </div>
            </div>

            <button className="auth-drawer-close" onClick={closeDrawer} aria-label="Kapat">
              ✕
            </button>
          </div>

          {/* Drawer Body - Auth Form */}
          <div className="auth-drawer-body">
            {/* Segmented Mode Switcher */}
            <div className="auth-segmented-tabs-light">
              <button
                type="button"
                className={`auth-segmented-tab-light ${mode === 'login' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('login')}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                className={`auth-segmented-tab-light ${mode === 'register' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('register')}
              >
                Kayıt Ol
              </button>
            </div>

            {/* Error / Expiration Alerts */}
            {sessionExpiredMessage && (
              <div className="auth-alert auth-alert-warning" role="alert">
                <span>{sessionExpiredMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="auth-alert auth-alert-danger" role="alert">
                <span>{errorMessage}</span>
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="auth-form" noValidate>
                <div className="auth-form-group">
                  <label htmlFor="drawer-userNameOrEmail">Kullanıcı Adı veya E-posta *</label>
                  <input
                    id="drawer-userNameOrEmail"
                    name="username"
                    autoComplete="username"
                    type="text"
                    className="auth-input-light"
                    placeholder="Kullanıcı adı veya e-posta girin"
                    value={userNameOrEmail}
                    onChange={(e) => setUserNameOrEmail(e.target.value)}
                    onInput={(e) => setUserNameOrEmail((e.target as HTMLInputElement).value)}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>

                <div className="auth-form-group">
                  <label htmlFor="drawer-password">Parola *</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="drawer-password"
                      name="password"
                      autoComplete="current-password"
                      type={showLoginPassword ? 'text' : 'password'}
                      className="auth-input-light"
                      placeholder="Parolanızı girin"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle-light"
                      onClick={() => setShowLoginPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showLoginPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="auth-submit-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </button>
              </form>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="auth-form" noValidate>
                <div className="auth-form-row">
                  <div className="auth-form-group">
                    <label htmlFor="drawer-regFirstName">Ad *</label>
                    <input
                      id="drawer-regFirstName"
                      type="text"
                      className="auth-input-light"
                      placeholder="Adınız"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </div>
                  <div className="auth-form-group">
                    <label htmlFor="drawer-regLastName">Soyad *</label>
                    <input
                      id="drawer-regLastName"
                      type="text"
                      className="auth-input-light"
                      placeholder="Soyadınız"
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="auth-form-group">
                  <label htmlFor="drawer-regUserName">Kullanıcı Adı *</label>
                  <input
                    id="drawer-regUserName"
                    type="text"
                    className="auth-input-light"
                    placeholder="Kullanıcı adınız"
                    value={regUserName}
                    onChange={(e) => setRegUserName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="auth-form-group">
                  <label htmlFor="drawer-regEmail">E-posta *</label>
                  <input
                    id="drawer-regEmail"
                    type="email"
                    className="auth-input-light"
                    placeholder="ornek@site.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="auth-form-group">
                  <label htmlFor="drawer-regPassword">Parola *</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="drawer-regPassword"
                      type={showRegPassword ? 'text' : 'password'}
                      className="auth-input-light"
                      placeholder="En az 8 karakter"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle-light"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showRegPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <div className="auth-form-group">
                  <label htmlFor="drawer-regConfirmPassword">Parola Tekrarı *</label>
                  <div className="auth-input-wrapper">
                    <input
                      id="drawer-regConfirmPassword"
                      type={showRegConfirmPassword ? 'text' : 'password'}
                      className="auth-input-light"
                      placeholder="Parolanızı tekrar girin"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="auth-password-toggle-light"
                      onClick={() => setShowRegConfirmPassword((prev) => !prev)}
                      tabIndex={-1}
                    >
                      {showRegConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="auth-submit-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Kayıt olunuyor...' : 'Kayıt Ol'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
