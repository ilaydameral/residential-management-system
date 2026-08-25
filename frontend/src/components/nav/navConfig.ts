export type NavCategoryId = 'general' | 'structures' | 'people' | 'finance' | 'operations' | 'system'

export interface NavChildItem {
  id: string
  label: string
  path: string
  description?: string
  adminOnly?: boolean
  managerOnly?: boolean
}

export interface NavCategory {
  id: NavCategoryId
  label: string
  iconName: string
  children: NavChildItem[]
}

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'general',
    label: 'Genel',
    iconName: 'home',
    children: [
      { id: 'overview', label: 'Genel Bakış', path: '/dashboard', description: 'Site ve sistem genel özet paneli.' },
      { id: 'managerScope', label: 'Yöneticilik Kapsamım', path: '/manager/my-scope', description: 'Atanan yapı ve blok sorumlulukları.', managerOnly: true },
    ],
  },
  {
    id: 'structures',
    label: 'Yapılar',
    iconName: 'building',
    children: [
      { id: 'properties', label: 'Siteler / Yapılar', path: '/properties', description: 'Site ve yapı kayıtlarını yönetin.' },
      { id: 'buildings', label: 'Bloklar', path: '/buildings', description: 'Blok ve bina kayıtlarına ulaşın.' },
      { id: 'units', label: 'Daireler', path: '/units', description: 'Daire ve bağımsız bölümleri yönetin.' },
      { id: 'floorMap', label: 'Kat Planı', path: '/management/floor-map', description: 'Dairelerin kat planı durumunu inceleyin.' },
    ],
  },
  {
    id: 'people',
    label: 'Kişiler',
    iconName: 'users',
    children: [
      { id: 'residents', label: 'Sakinler & Oturumlar', path: '/residents', description: 'Daire sakinlerini ve yerleşim durumlarını yönetin.' },
      { id: 'users', label: 'Kullanıcı Yönetimi', path: '/users', description: 'Sistem kullanıcı hesaplarını yönetin.', adminOnly: true },
      { id: 'managerAssignments', label: 'Yönetici Atamaları', path: '/manager-assignments', description: 'Site yöneticisi sorumluluklarını yönetin.', adminOnly: true },
    ],
  },
  {
    id: 'finance',
    label: 'Finans',
    iconName: 'wallet',
    children: [
      { id: 'financeOverview', label: 'Finansal Genel Bakış', path: '/management/finance', description: 'Finansal durum ve grafik takibi.' },
      { id: 'dueDefinitions', label: 'Aidat Tanımları', path: '/management/finance/due-definitions', description: 'Düzenli aidat şablonlarını yönetin.' },
      { id: 'duePeriods', label: 'Aidat Dönemleri', path: '/management/finance/due-periods', description: 'Dönemsel aidat borçlandırmaları.' },
      { id: 'expenses', label: 'Gider Yönetimi', path: '/management/finance/expenses', description: 'Gider kayıtları ve borçlandırma modları.' },
      { id: 'paymentSubmissions', label: 'Ödeme Bildirimleri', path: '/management/finance/payment-submissions', description: 'Sakin ödeme dekont onayları.' },
    ],
  },
  {
    id: 'operations',
    label: 'Operasyon',
    iconName: 'tools',
    children: [
      { id: 'maintenanceRequests', label: 'Bakım & Arıza Talepleri', path: '/management/maintenance-requests', description: 'Bakım talepleri ve Kanban takibi.' },
      { id: 'facilities', label: 'Ortak Alanlar', path: '/management/facilities', description: 'Ortak alan tesisleri ve rezervasyon yönetimi.' },
      { id: 'visitors', label: 'Ziyaretçi Yönetimi', path: '/management/visitors', description: 'Ziyaretçi kayıtları ve giriş-çıkış takibi.' },
      { id: 'vehicles', label: 'Araç Dizini', path: '/management/vehicles', description: 'Site sakinlerine ait kayıtlı araç dizini.' },
      { id: 'announcements', label: 'Duyurular', path: '/management/announcements', description: 'Sakinlere yönelik duyurular.' },
    ],
  },
  {
    id: 'system',
    label: 'Sistem',
    iconName: 'settings',
    children: [
      { id: 'dataImport', label: 'Veri Aktarımı', path: '/management/import', description: 'CSV ve XLSX dosyalarından toplu aktarım.', adminOnly: true },
      { id: 'settings', label: 'Ayarlar', path: '/settings', description: 'Görünüm ve sistem tercihleri.' },
      { id: 'account', label: 'Hesap / Profil', path: '/account', description: 'Kullanıcı hesabı ve profil bilgileri.' },
    ],
  },
]
