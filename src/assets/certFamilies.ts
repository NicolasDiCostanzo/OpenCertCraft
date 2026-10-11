export interface CertFamily {
  id: string
  label: string
  codes: string[]
}

export const CERT_FAMILIES: readonly CertFamily[] = [
  { id: 'aws', label: 'AWS', codes: ['DVA-C02', 'CLF-C02'] },
  { id: 'claude', label: 'Claude', codes: ['CCA-F', 'CCAO-F', 'CCAR-P', 'CCDV-F'] },
  { id: 'gcp', label: 'Google Cloud', codes: ['GCP-ACE'] },
  { id: 'kubernetes', label: 'Kubernetes', codes: ['CKA', 'CKS'] },
  { id: 'scaleway', label: 'Scaleway', codes: ['SCW-SA', 'SCW-FND', 'SCW-SEC'] },
]

export const CERT_FAMILY: Record<string, string> = Object.fromEntries(
  CERT_FAMILIES.flatMap((family) => family.codes.map((code) => [code, family.id])),
)

export function familyCertCount(groups: { certs: { length: number } }[]): number {
  return groups.reduce((total, group) => total + group.certs.length, 0)
}
