import certManifestRaw from '../assets/cert-manifest.json'
import { CERT_FAMILIES } from '../assets/certFamilies'
import type { CertBundle, CertBundleMeta, CertFamilyGroup, CertManifestEntry, Question } from '../types'
import { isQuestionAnswerable, validateCertBundle } from '../utils/schemaValidator'

const certManifest = certManifestRaw as unknown as CertManifestEntry[]

type ModuleLoader = () => Promise<{ default: unknown }>

const modules: Record<string, ModuleLoader> = import.meta.glob<{ default: unknown }>(
  '/src/assets/*questions.json',
)

export function createCertRegistry(
  moduleLoaders: Record<string, ModuleLoader>,
  manifest: CertManifestEntry[],
) {
  const seenCodes = new Set<string>()
  for (const entry of manifest) {
    if (seenCodes.has(entry.exam.code)) {
      throw new Error(
        `Duplicate exam code "${entry.exam.code}" in the cert manifest. Remove or rename one of the entries before shipping.`,
      )
    }
    seenCodes.add(entry.exam.code)
    if (!moduleLoaders[`/src/assets/${entry.file}`]) {
      throw new Error(
        `Cert manifest references "${entry.file}" but no matching /src/assets/*questions.json file exists.`,
      )
    }
  }

  const certs = new Map<string, CertBundle>()
  const issuesByPath: Record<string, string[]> = {}

  async function ensureCertLoaded(examCode: string): Promise<boolean> {
    if (certs.has(examCode)) return true
    const entry = manifest.find((candidate) => candidate.exam.code === examCode)
    if (!entry) return false
    const path = `/src/assets/${entry.file}`
    try {
      const mod = await moduleLoaders[path]()
      const result = validateCertBundle(mod.default)
      if (!result.valid || !result.bundle) {
        issuesByPath[path] = result.errors
        console.error(`Cert bundle "${path}" was excluded due to load issues:`, result.errors)
        return false
      }
      if (result.bundle.exam.code !== entry.exam.code) {
        const errors = [
          `Bundle exam code "${result.bundle.exam.code}" does not match manifest entry "${entry.exam.code}".`,
        ]
        issuesByPath[path] = errors
        console.error(`Cert bundle "${path}" was excluded due to load issues:`, errors)
        return false
      }
      certs.set(result.bundle.exam.code, result.bundle)
      return true
    } catch (error) {
      const errors = [error instanceof Error ? error.message : String(error)]
      issuesByPath[path] = errors
      console.error(`Cert bundle "${path}" could not be loaded:`, error)
      return false
    }
  }

  function getCert(examCode: string): CertBundle | undefined {
    return certs.get(examCode)
  }

  function activePool(examCode: string): Question[] {
    return getCert(examCode)?.questions.filter(isQuestionAnswerable) ?? []
  }

  function resolveQuestions(examCode: string, questionIds: string[]): Question[] {
    const cert = getCert(examCode)
    if (!cert) return []
    const byId = new Map(cert.questions.map((q) => [q.id, q]))
    return questionIds.map((id) => byId.get(id)).filter((q): q is Question => q !== undefined)
  }

  function availableCertMetas(): CertBundleMeta[] {
    return manifest.map(({ exam, questionCount }) => ({ exam, questionCount }))
  }

  function groupedCertMetas(): CertFamilyGroup[] {
    const metas = availableCertMetas()
    const byCode = new Map(metas.map((meta) => [meta.exam.code, meta]))
    const groups = CERT_FAMILIES.map((family) => ({
      familyId: family.id,
      label: family.label,
      certs: family.codes.map((code) => byCode.get(code)).filter((meta): meta is CertBundleMeta => meta !== undefined),
    })).filter((group) => group.certs.length > 0)
    const known = new Set(CERT_FAMILIES.flatMap((family) => family.codes))
    const ungrouped = metas.filter((meta) => !known.has(meta.exam.code))
    if (ungrouped.length > 0) groups.push({ familyId: 'other', label: 'Other', certs: ungrouped })
    return groups
  }

  return {
    ensureCertLoaded,
    getCert,
    activePool,
    resolveQuestions,
    availableCertMetas,
    groupedCertMetas,
    issuesByPath,
  }
}

const registry = createCertRegistry(modules, certManifest)

export function useQuizLoader() {
  return {
    availableCerts: registry.availableCertMetas(),
    groupedCerts: registry.groupedCertMetas(),
    certLoadIssues: registry.issuesByPath,
    ensureCertLoaded: registry.ensureCertLoaded,
    getCert: registry.getCert,
    activePool: registry.activePool,
    resolveQuestions: registry.resolveQuestions,
  }
}
