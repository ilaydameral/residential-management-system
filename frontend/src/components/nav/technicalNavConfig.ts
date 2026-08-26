export type TechnicalNavCategoryId = 'general' | 'system'

export interface TechnicalNavChildItem {
  id: string
  label: string
  path: string
  description?: string
}

export interface TechnicalNavCategory {
  id: TechnicalNavCategoryId
  label: string
  iconName: string
  children: TechnicalNavChildItem[]
}

export const TECHNICAL_NAV_CATEGORIES: TechnicalNavCategory[] = [
  {
    id: 'general',
    label: 'Genel',
    iconName: 'tools',
    children: [
      { id: 'technicalRequests', label: 'Atanan Talepler', path: '/technical/requests', description: 'Size atanan bakım talepleri ve iş emri takibi.' },
    ],
  },
  {
    id: 'system',
    label: 'Sistem',
    iconName: 'settings',
    children: [
      { id: 'settings', label: 'Ayarlar', path: '/settings', description: 'Görünüm ve sistem tercihleri.' },
      { id: 'account', label: 'Hesap / Profil', path: '/account', description: 'Kullanıcı profiliniz.' },
    ],
  },
]
