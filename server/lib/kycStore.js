import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.join(__dirname, '..', 'data', 'kyc-submissions.json')

/** @typedef {'pending' | 'approved' | 'rejected'} KycStatus */
/** @typedef {'low' | 'standard' | 'elevated' | 'high'} KycRiskLevel */

const RISK_LEVELS = new Set(['low', 'standard', 'elevated', 'high'])

const DOC_KINDS = new Set(['id_front', 'id_back', 'proof_of_address', 'other'])
const MAX_KYC_UPLOAD_TOTAL_BYTES = 8 * 1024 * 1024
const MAX_KYC_FILES = 6

function ensureDir() {
  const dir = path.dirname(DATA_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function defaultSeedItems() {
  const now = new Date()
  const iso = (d) => d.toISOString()
  const addDays = (n) => {
    const x = new Date(now)
    x.setDate(x.getDate() + n)
    return x
  }
  return [
    {
      id: 'kyc-seed-1',
      userId: 'usr_b9aac462a765ae6ec01c9705',
      customerEmail: 'dev@example.invalid',
      customerDisplayName: 'Dev User',
      status: 'pending',
      riskLevel: 'standard',
      documentExpiresAt: iso(addDays(420)).slice(0, 10),
      complianceNotes: '',
      documents: [
        {
          id: 'doc-seed-1a',
          kind: 'id_front',
          fileName: 'drivers-license-front.jpg',
          uploadedAt: iso(addDays(-2)),
          contentType: 'image/jpeg',
          bytesApprox: 842_000,
        },
        {
          id: 'doc-seed-1b',
          kind: 'id_back',
          fileName: 'drivers-license-back.jpg',
          uploadedAt: iso(addDays(-2)),
          contentType: 'image/jpeg',
          bytesApprox: 801_000,
        },
        {
          id: 'doc-seed-1c',
          kind: 'proof_of_address',
          fileName: 'utility-statement-march.pdf',
          uploadedAt: iso(addDays(-1)),
          contentType: 'application/pdf',
          bytesApprox: 312_000,
        },
      ],
      createdAt: iso(addDays(-3)),
      decidedAt: null,
      decisionNote: null,
    },
    {
      id: 'kyc-seed-2',
      userId: 'usr_kyc_queue_demo_b',
      customerEmail: 'queue.case.b@example.invalid',
      customerDisplayName: 'Queue case B (demo)',
      status: 'pending',
      riskLevel: 'elevated',
      documentExpiresAt: iso(addDays(45)).slice(0, 10),
      complianceNotes:
        'Prior address mismatch on file; request secondary review before approval.',
      documents: [
        {
          id: 'doc-seed-2a',
          kind: 'id_front',
          fileName: 'passport-scan.png',
          uploadedAt: iso(addDays(-5)),
          contentType: 'image/png',
          bytesApprox: 1_204_000,
        },
        {
          id: 'doc-seed-2b',
          kind: 'other',
          fileName: 'signature-card.pdf',
          uploadedAt: iso(addDays(-5)),
          contentType: 'application/pdf',
          bytesApprox: 88_000,
        },
      ],
      createdAt: iso(addDays(-6)),
      decidedAt: null,
      decisionNote: null,
    },
    {
      id: 'kyc-seed-3',
      userId: 'usr_b9aac462a765ae6ec01c9705',
      customerEmail: 'dev@example.invalid',
      customerDisplayName: 'Dev User',
      status: 'approved',
      riskLevel: 'low',
      documentExpiresAt: iso(addDays(730)).slice(0, 10),
      complianceNotes: 'Annual refresh — prior submission on file.',
      documents: [
        {
          id: 'doc-seed-3a',
          kind: 'id_front',
          fileName: 'state-id-2024-front.jpg',
          uploadedAt: iso(addDays(-400)),
          contentType: 'image/jpeg',
          bytesApprox: 640_000,
        },
      ],
      createdAt: iso(addDays(-405)),
      decidedAt: iso(addDays(-398)),
      decisionNote: 'Documents legible; identity matches enrollment records.',
    },
  ]
}

function readFile() {
  ensureDir()
  if (!fs.existsSync(DATA_PATH)) {
    const initial = { items: defaultSeedItems() }
    fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), 'utf8')
    return initial
  }
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8')
    const data = JSON.parse(raw)
    if (!data || !Array.isArray(data.items)) return { items: defaultSeedItems() }
    if (data.items.length === 0) {
      const next = { items: defaultSeedItems() }
      writeFile(next)
      return next
    }
    return data
  } catch {
    return { items: defaultSeedItems() }
  }
}

function writeFile(data) {
  ensureDir()
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8')
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function uploadsRootDir() {
  return path.join(__dirname, '..', 'data', 'kyc-uploads')
}

function safeFileSuffix(fileName) {
  const m = String(fileName || '').match(/\.([a-z0-9]{1,8})$/i)
  return m ? `.${m[1].toLowerCase()}` : '.bin'
}

/**
 * @param {string} userId
 */
export function userHasPendingKyc(userId) {
  const uidNorm = String(userId || '').trim()
  if (!uidNorm) return false
  return listKycSubmissions({ status: 'pending', limit: 500 }).some(
    (x) => x.userId === uidNorm,
  )
}

/**
 * Latest submission for a user (any status), or null.
 * @param {string} userId
 */
export function getLatestKycForUser(userId) {
  const uidNorm = String(userId || '').trim()
  if (!uidNorm) return null
  const rows = listKycSubmissions({ limit: 500 }).filter((x) => x.userId === uidNorm)
  if (!rows.length) return null
  rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  return rows[0]
}

/**
 * @param {string} submissionId
 * @param {string} docId
 * @returns {{ buffer: Buffer, contentType: string } | null}
 */
export function readKycDocumentFile(submissionId, docId) {
  const item = getKycSubmission(submissionId)
  if (!item) return null
  const doc = item.documents.find((d) => d.id === docId)
  if (!doc || typeof doc.storagePath !== 'string' || !doc.storagePath) return null
  const rel = doc.storagePath.replace(/\\/g, '/')
  if (!rel || rel.includes('..') || path.isAbsolute(rel)) return null
  const dataRoot = path.resolve(__dirname, '..', 'data')
  const abs = path.resolve(dataRoot, rel)
  if (!abs.startsWith(dataRoot + path.sep) && abs !== dataRoot) return null
  if (!fs.existsSync(abs)) return null
  return {
    buffer: fs.readFileSync(abs),
    contentType: String(doc.contentType || 'application/octet-stream'),
  }
}

/**
 * @param {{
 *   userId: string
 *   customerEmail: string
 *   customerDisplayName: string
 *   documents: Array<{ kind: string, fileName: string, contentType: string, buffer: Buffer }>
 * }} input
 */
export function createCustomerKycSubmission(input) {
  const userId = String(input.userId || '').trim()
  const customerEmail = String(input.customerEmail || '').trim().slice(0, 200)
  const customerDisplayName = String(input.customerDisplayName || '')
    .trim()
    .slice(0, 200)
  if (!userId || !customerEmail) {
    const err = new Error('Missing customer identity.')
    err.statusCode = 400
    throw err
  }
  if (userHasPendingKyc(userId)) {
    const err = new Error(
      'You already have a KYC package awaiting review. Wait for a decision before uploading again.',
    )
    err.statusCode = 409
    throw err
  }
  const rawDocs = Array.isArray(input.documents) ? input.documents : []
  if (rawDocs.length === 0 || rawDocs.length > MAX_KYC_FILES) {
    const err = new Error(
      `Provide between 1 and ${MAX_KYC_FILES} documents (ID front is required).`,
    )
    err.statusCode = 400
    throw err
  }
  let total = 0
  for (const d of rawDocs) {
    total += d.buffer?.length || 0
  }
  if (total <= 0 || total > MAX_KYC_UPLOAD_TOTAL_BYTES) {
    const err = new Error(
      `Total upload size must be under ${Math.round(MAX_KYC_UPLOAD_TOTAL_BYTES / (1024 * 1024))} MB.`,
    )
    err.statusCode = 400
    throw err
  }
  const hasIdFront = rawDocs.some((d) => d.kind === 'id_front')
  if (!hasIdFront) {
    const err = new Error('ID front image is required.')
    err.statusCode = 400
    throw err
  }

  const submissionId = uid('kyc')
  const uploadDir = path.join(uploadsRootDir(), submissionId)
  fs.mkdirSync(uploadDir, { recursive: true })

  const documents = []
  const now = new Date().toISOString()
  for (const d of rawDocs) {
    const kind = String(d.kind || '').trim()
    if (!DOC_KINDS.has(kind)) {
      const err = new Error(`Invalid document kind: ${kind}`)
      err.statusCode = 400
      throw err
    }
    const fileName = String(d.fileName || 'upload').trim().slice(0, 180) || 'upload'
    const contentType = String(d.contentType || 'application/octet-stream')
      .trim()
      .slice(0, 120)
    const buf = d.buffer instanceof Buffer ? d.buffer : Buffer.alloc(0)
    if (buf.length === 0) {
      const err = new Error('Each document must include file data.')
      err.statusCode = 400
      throw err
    }
    const docId = uid('doc')
    const rel = path.join('kyc-uploads', submissionId, `${docId}${safeFileSuffix(fileName)}`)
    const abs = path.join(__dirname, '..', 'data', rel)
    fs.writeFileSync(abs, buf)
    documents.push({
      id: docId,
      kind,
      fileName,
      uploadedAt: now,
      contentType,
      bytesApprox: buf.length,
      storagePath: rel.split(path.sep).join('/'),
    })
  }

  const item = {
    id: submissionId,
    userId,
    customerEmail,
    customerDisplayName,
    status: /** @type {'pending'} */ ('pending'),
    riskLevel: /** @type {'standard'} */ ('standard'),
    documentExpiresAt: null,
    complianceNotes: '',
    documents,
    createdAt: now,
    decidedAt: null,
    decisionNote: null,
  }
  const data = readFile()
  data.items.unshift(item)
  writeFile(data)
  return item
}

/**
 * @param {{ status?: string, limit?: number }} [opts]
 */
export function listKycSubmissions(opts = {}) {
  const data = readFile()
  let items = [...data.items]
  const st =
    typeof opts.status === 'string' ? opts.status.trim().toLowerCase() : ''
  if (st === 'pending' || st === 'approved' || st === 'rejected') {
    items = items.filter((x) => x.status === st)
  }
  items.sort((a, b) => {
    const ta = Date.parse(a.createdAt)
    const tb = Date.parse(b.createdAt)
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta)
  })
  const limit = Math.min(Math.max(Number(opts.limit) || 200, 1), 500)
  return items.slice(0, limit)
}

/**
 * @param {string} id
 */
export function getKycSubmission(id) {
  const data = readFile()
  return data.items.find((x) => x.id === id) ?? null
}

/**
 * @param {string} id
 * @param {Record<string, unknown>} body
 */
export function patchKycSubmission(id, body) {
  const data = readFile()
  const idx = data.items.findIndex((x) => x.id === id)
  if (idx === -1) {
    const err = new Error('KYC submission not found.')
    err.statusCode = 404
    throw err
  }
  const item = { ...data.items[idx] }

  if (body && typeof body === 'object') {
    if (typeof body.riskLevel === 'string') {
      const rl = body.riskLevel.trim().toLowerCase()
      if (!RISK_LEVELS.has(rl)) {
        const err = new Error('riskLevel must be low, standard, elevated, or high.')
        err.statusCode = 400
        throw err
      }
      item.riskLevel = rl
    }
    if (body.documentExpiresAt === null) {
      item.documentExpiresAt = null
    } else if (typeof body.documentExpiresAt === 'string') {
      const d = body.documentExpiresAt.trim()
      if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        const err = new Error('documentExpiresAt must be YYYY-MM-DD or null.')
        err.statusCode = 400
        throw err
      }
      item.documentExpiresAt = d || null
    }
    if (typeof body.complianceNotes === 'string') {
      item.complianceNotes = body.complianceNotes.trim().slice(0, 4000)
    }
    const action =
      typeof body.decision === 'string' ? body.decision.trim().toLowerCase() : ''
    if (action === 'approve' || action === 'reject') {
      if (item.status !== 'pending') {
        const err = new Error('Only pending submissions can be decided.')
        err.statusCode = 409
        throw err
      }
      const note =
        typeof body.decisionNote === 'string' ? body.decisionNote.trim().slice(0, 2000) : ''
      if (action === 'reject' && !note) {
        const err = new Error('decisionNote is required when rejecting.')
        err.statusCode = 400
        throw err
      }
      item.status = action === 'approve' ? 'approved' : 'rejected'
      item.decidedAt = new Date().toISOString()
      item.decisionNote = note || null
    }
  }

  data.items[idx] = item
  writeFile(data)
  return item
}
