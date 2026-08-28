export type ResidentNavCategoryId = 'general' | 'lifestyle' | 'finance' | 'communication'

export interface ResidentNavChildItem {
  id: string
  label: string
  path: string
  description?: string
}

export interface ResidentNavCategory {
  id: ResidentNavCategoryId
  label: string
  iconName: string
  children: ResidentNavChildItem[]
}

export const RESIDENT_NAV_CATEGORIES: ResidentNavCategory[] = [
  {
    id: 'general',
    label: 'Genel',
    iconName: 'home',
    children: [
      { id: 'home', label: 'Ana Sayfa', path: '/resident/home', description: 'Portala genel bakış ve özeti.' },
    ],
  },
  {
    id: 'lifestyle',
    label: 'Yaşam',
    iconName: 'building',
    children: [
      { id: 'myUnits', label: 'Dairelerim', path: '/resident/my-units', description: 'Kayıtlı daireleriniz ve yerleşim detayları.' },
      { id: 'facilities', label: 'Ortak Alanlar', path: '/resident/facilities', description: 'Ortak alan tesisleri ve rezervasyon takibi.' },
      { id: 'visitors', label: 'Ziyaretçiler', path: '/resident/visitors', description: 'Ziyaretçi kayıtları ve giriş takibi.' },
      { id: 'vehicles', label: 'Araçlarım', path: '/resident/vehicles', description: 'Kayıtlı araç dizininiz ve plakalar.' },
    ],
  },
  {
    id: 'finance',
    label: 'Finans',
    iconName: 'wallet',
    children: [
      { id: 'finance', label: 'Finans', path: '/resident/finance', description: 'Aidat borçları, harcamalar ve ödeme takibi.' },
    ],
  },
  {
    id: 'communication',
    label: 'İletişim',
    iconName: 'tools',
    children: [
      { id: 'announcements', label: 'Duyurular', path: '/resident/announcements', description: 'Sakinlere yönelik duyuru ve bilgilendirmeler.' },
      { id: 'requests', label: 'Taleplerim', path: '/resident/requests', description: 'Bakım ve arıza bildirimleriniz.' },
    ],
  },
]
