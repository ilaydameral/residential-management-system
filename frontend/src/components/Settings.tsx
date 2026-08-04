import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { changeMyAccountPassword, getMyAccountProfile, updateMyAccountProfile } from '../api'
import { useAuth } from '../context/AuthContext'
import { useTheme, type ThemePreference } from '../context/ThemeContext'
import { useToast } from '../context/ToastContext'
import type { AccountProfile } from '../types'
import { LoadingSkeleton } from './LoadingSkeleton'
import { SaveShortcutHint } from './SaveShortcutHint'

type SettingsEditor = 'account' | 'password'

interface SettingsProps {
  onDirtyChange: (isDirty: boolean) => void
  requestDiscard: (hasChanges?: boolean) => Promise<boolean>
}

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: 'light', label: 'Açık', description: 'Uygulamayı her zaman açık temada kullanır.' },
  { value: 'dark', label: 'Koyu', description: 'Uygulamayı her zaman koyu temada kullanır.' },
  { value: 'system', label: 'Sistem', description: 'Cihazınızın görünüm ayarını takip eder.' },
]

function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function getFullNameValidationError(value: string): string {
  const normalizedValue = normalizeFullName(value)
  if (!normalizedValue) return 'Ad soyad alanı zorunludur.'
  if (normalizedValue.length < 3 || normalizedValue.length > 151) return 'Ad soyad 3 ile 151 karakter arasında olmalıdır.'
  const separatorIndex = normalizedValue.lastIndexOf(' ')
  if (separatorIndex <= 0) return 'Adınızı ve soyadınızı birlikte giriniz.'
  if (normalizedValue.slice(0, separatorIndex).length > 75 || normalizedValue.slice(separatorIndex + 1).length > 75) {
    return 'Ad ve soyad alanları ayrı ayrı en fazla 75 karakter olabilir.'
  }
  return ''
}

export function Settings({ onDirtyChange, requestDiscard }: SettingsProps) {
  const navigate = useNavigate()
  const { logout, updateCurrentUserFullName } = useAuth()
  const { showToast } = useToast()
  const { preference, resolvedTheme, isThemeTransitioning, setThemePreference } = useTheme()
  const [profile, setProfile] = useState<AccountProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [activeEditor, setActiveEditor] = useState<SettingsEditor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [profileError, setProfileError] = useState('')
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const passwordTriggerRef = useRef<HTMLButtonElement>(null)
  const fullNameInputRef = useRef<HTMLInputElement>(null)
  const currentPasswordInputRef = useRef<HTMLInputElement>(null)

  const accountDirty = activeEditor === 'account' && normalizeFullName(fullName) !== profile?.fullName
  const passwordDirty = activeEditor === 'password' && Boolean(currentPassword || newPassword || confirmNewPassword)
  const isDirty = accountDirty || passwordDirty

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const loadProfile = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const currentProfile = await getMyAccountProfile()
      setProfile(currentProfile)
      setFullName(currentProfile.fullName)
    } catch (loadErrorValue) {
      setProfile(null)
      setLoadError(loadErrorValue instanceof Error ? loadErrorValue.message : 'Hesap bilgileriniz yüklenemedi.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void loadProfile() }, [loadProfile])

  const clearPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmNewPassword('')
    setPasswordError('')
    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const resetEditor = (editor: SettingsEditor) => {
    if (editor === 'account') {
      setFullName(profile?.fullName ?? '')
      setProfileError('')
    } else {
      clearPasswordForm()
    }
  }

  const focusEditor = (editor: SettingsEditor) => {
    window.requestAnimationFrame(() => {
      if (editor === 'account') fullNameInputRef.current?.focus()
      else currentPasswordInputRef.current?.focus()
    })
  }

  const focusEditorTrigger = (editor: SettingsEditor) => {
    window.requestAnimationFrame(() => {
      if (editor === 'account') accountTriggerRef.current?.focus()
      else passwordTriggerRef.current?.focus()
    })
  }

  const openEditor = async (editor: SettingsEditor) => {
    if (activeEditor === editor) return
    if (isDirty && !(await requestDiscard(true))) return
    if (activeEditor) resetEditor(activeEditor)
    resetEditor(editor)
    setActiveEditor(editor)
    focusEditor(editor)
  }

  const closeEditor = async (force = false) => {
    if (!activeEditor) return
    const editor = activeEditor
    if (!force && isDirty && !(await requestDiscard(true))) return
    resetEditor(editor)
    setActiveEditor(null)
    focusEditorTrigger(editor)
  }

  const handleAccountNavigation = async () => {
    if (isDirty && !(await requestDiscard(true))) return
    if (activeEditor) resetEditor(activeEditor)
    onDirtyChange(false)
    navigate('/account')
  }

  const handleFormKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape' && !isUpdatingProfile && !isChangingPassword) {
      event.preventDefault()
      event.stopPropagation()
      void closeEditor()
      return
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      if (isUpdatingProfile || isChangingPassword) return
      event.currentTarget.requestSubmit()
    }
  }

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isUpdatingProfile) return

    const normalizedFullName = normalizeFullName(fullName)
    const validationError = getFullNameValidationError(normalizedFullName)
    if (validationError) {
      setProfileError(validationError)
      fullNameInputRef.current?.focus()
      return
    }
    if (normalizedFullName === profile?.fullName) return

    setIsUpdatingProfile(true)
    setProfileError('')
    try {
      const updatedProfile = await updateMyAccountProfile({ fullName: normalizedFullName })
      setProfile(updatedProfile)
      setFullName(updatedProfile.fullName)
      updateCurrentUserFullName(updatedProfile.fullName)
      setActiveEditor(null)
      focusEditorTrigger('account')
      showToast('Ad soyad bilginiz güncellendi.')
    } catch (updateError) {
      setProfileError(updateError instanceof Error ? updateError.message : 'Ad soyad bilginiz güncellenemedi.')
    } finally {
      setIsUpdatingProfile(false)
    }
  }

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isChangingPassword) return

    setPasswordError('')
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setPasswordError('Tüm şifre alanlarını doldurunuz.')
      return
    }
    if (newPassword.length < 8 || newPassword.length > 100) {
      setPasswordError('Yeni şifre 8 ile 100 karakter arasında olmalıdır.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Yeni şifreler birbiriyle eşleşmiyor.')
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError('Yeni şifreniz mevcut şifrenizden farklı olmalıdır.')
      return
    }

    setIsChangingPassword(true)
    try {
      await changeMyAccountPassword({ currentPassword, newPassword, confirmNewPassword })
      clearPasswordForm()
      onDirtyChange(false)
      logout()
      navigate('/login', { replace: true, state: { successMessage: 'Şifreniz değiştirildi. Yeni şifrenizle giriş yapın.' } })
    } catch (changeError) {
      setCurrentPassword('')
      setPasswordError(changeError instanceof Error ? changeError.message : 'Şifreniz değiştirilemedi.')
      setIsChangingPassword(false)
      window.requestAnimationFrame(() => currentPasswordInputRef.current?.focus())
    }
  }

  const renderPasswordInput = (
    id: string,
    label: string,
    value: string,
    setValue: (value: string) => void,
    visible: boolean,
    setVisible: (visible: boolean) => void,
    autoComplete: 'current-password' | 'new-password',
    inputRef?: RefObject<HTMLInputElement | null>,
  ) => (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-input-wrap">
        <input ref={inputRef} id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => setValue(event.target.value)} autoComplete={autoComplete} minLength={autoComplete === 'new-password' ? 8 : undefined} maxLength={100} disabled={isChangingPassword} required />
        <button className="password-visibility-button" type="button" aria-label={visible ? `${label} değerini gizle` : `${label} değerini göster`} disabled={isChangingPassword} onClick={() => setVisible(!visible)}>{visible ? 'Gizle' : 'Göster'}</button>
      </div>
    </div>
  )

  return (
    <section className="settings-view" aria-busy={isLoading}>
      <section className="panel settings-section" aria-labelledby="appearance-settings-title">
        <div className="settings-section-heading"><div><h2 id="appearance-settings-title">Görünüm</h2><p>Uygulamanın size nasıl görüneceğini seçin.</p></div>{preference === 'system' && <span className="settings-resolved-theme" aria-live="polite">Şu anda {resolvedTheme === 'dark' ? 'koyu' : 'açık'} tema uygulanıyor</span>}</div>
        <fieldset className="theme-preference-group">
          <legend className="sr-only">Tema tercihi</legend>
          {THEME_OPTIONS.map((option) => {
            const isSelected = preference === option.value
            return <label className={`theme-preference-option ${isSelected ? 'selected' : ''}`} key={option.value}><input type="radio" name="theme-preference" value={option.value} checked={isSelected} disabled={isThemeTransitioning} onChange={() => setThemePreference(option.value)} /><span className="theme-preference-copy"><strong>{option.label}</strong><small>{option.description}</small></span><span className="theme-preference-state" aria-hidden="true">{isSelected ? 'Seçili' : ''}</span></label>
          })}
        </fieldset>
      </section>

      <section className="panel settings-section" aria-labelledby="account-settings-title">
        <div className="settings-section-heading"><div><h2 id="account-settings-title">Profil Düzenleme</h2><p>Uygulamada görünen adınızı yönetin.</p></div></div>
        {isLoading && <LoadingSkeleton variant="detail" />}
        {!isLoading && loadError && <div className="entity-state-panel error-state"><p className="status-message error-message" role="alert">{loadError}</p><button className="secondary-button" type="button" onClick={() => void loadProfile()}>Tekrar Dene</button></div>}
        {!isLoading && !loadError && profile && activeEditor !== 'account' && (
          <div className="settings-summary-content">
            <dl className="settings-account-summary"><div><dt>Kullanıcı Adı</dt><dd>{profile.userName?.trim() || 'Belirtilmemiş'}</dd></div><div><dt>E-posta</dt><dd>{profile.email?.trim() || 'Belirtilmemiş'}</dd></div></dl>
            <div className="settings-card-actions"><button ref={accountTriggerRef} className="primary-button" type="button" onClick={() => void openEditor('account')}>Bilgileri Düzenle</button><button className="secondary-button" type="button" onClick={() => void handleAccountNavigation()}>Hesabımı Gör</button></div>
          </div>
        )}
        {!isLoading && !loadError && profile && activeEditor === 'account' && (
          <form className="settings-form settings-editor" onSubmit={handleProfileSubmit} onKeyDown={handleFormKeyDown}>
            <div className="settings-form-heading"><h3>Ad Soyad Değiştir</h3><p>Bu ad, uygulamanın kullanıcı alanlarında görüntülenir.</p></div>
            <div className="settings-form-grid"><div className="form-field"><label htmlFor="settings-full-name">Ad Soyad</label><input ref={fullNameInputRef} id="settings-full-name" value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={3} maxLength={151} autoComplete="name" disabled={isUpdatingProfile} required /></div><div className="form-field"><label htmlFor="settings-email">E-posta</label><input id="settings-email" type="email" value={profile.email?.trim() || 'Belirtilmemiş'} readOnly aria-readonly="true" /></div></div>
            {profileError && <p className="status-message error-message" role="alert">{profileError}</p>}
            <div className="settings-form-actions"><SaveShortcutHint /><button className="secondary-button" type="button" disabled={isUpdatingProfile} onClick={() => void closeEditor()}>Vazgeç</button><button className="primary-button" type="submit" disabled={isUpdatingProfile || !accountDirty}>{isUpdatingProfile ? 'Kaydediliyor...' : 'Kaydet'}</button></div>
          </form>
        )}
      </section>

      <section className="panel settings-section" aria-labelledby="security-settings-title">
        <div className="settings-section-heading"><div><h2 id="security-settings-title">Güvenlik</h2><p>Güçlü ve yalnızca sizin bildiğiniz bir şifre kullanarak hesabınızı koruyun.</p></div></div>
        {activeEditor !== 'password' && <div className="settings-security-summary"><p>Şifrenizi düzenli aralıklarla ve başka hesaplarda kullanmadığınız bir değerle güncelleyin.</p><button ref={passwordTriggerRef} className="primary-button" type="button" onClick={() => void openEditor('password')}>Şifreyi Değiştir</button></div>}
        {activeEditor === 'password' && (
          <form className="settings-form settings-editor" onSubmit={handlePasswordSubmit} onKeyDown={handleFormKeyDown}>
            <div className="settings-form-heading"><h3>Şifre Değiştir</h3><p>Şifreniz değiştirildiğinde güvenlik amacıyla yeniden giriş yapmanız gerekir.</p></div>
            <div className="settings-password-grid">{renderPasswordInput('settings-current-password', 'Mevcut Şifre', currentPassword, setCurrentPassword, showCurrentPassword, setShowCurrentPassword, 'current-password', currentPasswordInputRef)}{renderPasswordInput('settings-new-password', 'Yeni Şifre', newPassword, setNewPassword, showNewPassword, setShowNewPassword, 'new-password')}{renderPasswordInput('settings-confirm-password', 'Yeni Şifre Tekrar', confirmNewPassword, setConfirmNewPassword, showConfirmPassword, setShowConfirmPassword, 'new-password')}</div>
            {passwordError && <p className="status-message error-message" role="alert">{passwordError}</p>}
            <div className="settings-form-actions"><SaveShortcutHint /><button className="secondary-button" type="button" disabled={isChangingPassword} onClick={() => void closeEditor()}>Vazgeç</button><button className="primary-button" type="submit" disabled={isChangingPassword}>{isChangingPassword ? 'Değiştiriliyor...' : 'Şifreyi Değiştir'}</button></div>
          </form>
        )}
      </section>
    </section>
  )
}
