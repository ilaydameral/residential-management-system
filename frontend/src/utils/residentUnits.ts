import type { OccupancyTypeCode, ResidentUnit } from '../types'

export interface ResidentOccupancySummary {
  occupancyType: OccupancyTypeCode
  isPrimary: boolean
  startDate: string
}

export interface GroupedResidentUnit {
  unitId: number
  propertyName: string
  buildingName: string
  unitNumber: string
  floorNumber: number
  unitTypeName: string
  grossArea: number | null
  netArea: number | null
  occupancies: ResidentOccupancySummary[]
}

export const OCCUPANCY_TYPE_LABELS: Record<OccupancyTypeCode, string> = {
  OWNER: 'Malik',
  TENANT: 'Kiracı',
  HOUSEHOLD_MEMBER: 'Hane Üyesi',
}

export function groupResidentUnits(records: ResidentUnit[]): GroupedResidentUnit[] {
  const grouped = new Map<number, GroupedResidentUnit>()

  for (const record of records) {
    const current = grouped.get(record.unitId) ?? {
      unitId: record.unitId,
      propertyName: record.propertyName,
      buildingName: record.buildingName,
      unitNumber: record.unitNumber,
      floorNumber: record.floorNumber,
      unitTypeName: record.unitTypeName,
      grossArea: record.grossArea,
      netArea: record.netArea,
      occupancies: [],
    }

    const alreadyIncluded = current.occupancies.some((occupancy) =>
      occupancy.occupancyType === record.occupancyType &&
      occupancy.isPrimary === record.isPrimary &&
      occupancy.startDate === record.startDate
    )

    if (!alreadyIncluded) {
      current.occupancies.push({
        occupancyType: record.occupancyType,
        isPrimary: record.isPrimary,
        startDate: record.startDate,
      })
    }

    grouped.set(record.unitId, current)
  }

  return Array.from(grouped.values())
}

export function formatResidentFloor(floorNumber: number): string {
  if (floorNumber === 0) return 'Zemin Kat'
  if (floorNumber < 0) return `Bodrum ${Math.abs(floorNumber)}. Kat`
  return `${floorNumber}. Kat`
}

export function formatResidentDate(value: string): string {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (dateOnlyMatch) {
    return `${dateOnlyMatch[3]}.${dateOnlyMatch[2]}.${dateOnlyMatch[1]}`
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '—'

  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}
