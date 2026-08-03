export function formatUnitNumber(unitNumber: string): string {
  const trimmed = unitNumber.trim()
  const withoutApartmentPrefix = trimmed.replace(/^(?:daire|d)\s*[:.-]?\s*/i, '').trim()
  return withoutApartmentPrefix || trimmed
}

export function formatUnitDisplay(unitNumber: string, unitTypeName?: string): string {
  const number = formatUnitNumber(unitNumber)
  return unitTypeName ? `${unitTypeName} ${number}` : number
}
