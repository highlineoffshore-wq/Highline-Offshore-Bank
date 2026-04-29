#!/usr/bin/env node
/**
 * Archives server/data JSON + log files into server/data/backups/
 * Optional encryption with age: set AGE_RECIPIENT to a public key.
 *
 * Usage: node server/scripts/backup-data.mjs
 */
import { execFileSync } from 'node:child_process'
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGzip } from 'node:zlib'
import { pipeline } from 'node:stream/promises'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
const backupDir = path.join(dataDir, 'backups')

function hasTar() {
  try {
    execFileSync('tar', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function main() {
  if (!existsSync(dataDir)) {
    console.error('No server/data directory found.')
    process.exit(1)
  }

  mkdirSync(backupDir, { recursive: true })

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseName = `banking-data-${stamp}.tar`
  const tarPath = path.join(backupDir, baseName)
  const gzPath = `${tarPath}.gz`

  const include = readdirSync(dataDir).filter(
    (f) =>
      f !== 'backups' &&
      (f.endsWith('.json') || f.endsWith('.log')) &&
      !f.startsWith('.'),
  )

  if (include.length === 0) {
    console.log('No data files to back up yet.')
    return
  }

  if (hasTar()) {
    execFileSync('tar', ['-cf', tarPath, '-C', dataDir, ...include], {
      stdio: 'inherit',
    })
    await pipeline(
      createReadStream(tarPath),
      createGzip(),
      createWriteStream(gzPath),
    )
    try {
      unlinkSync(tarPath)
    } catch {
      /* ignore */
    }
    console.log(`Backup written: ${gzPath}`)
  } else {
    console.warn(
      'tar not found; copying individual files to',
      path.join(backupDir, stamp),
    )
    const dest = path.join(backupDir, stamp)
    mkdirSync(dest, { recursive: true })
    const fs = await import('node:fs/promises')
    for (const f of include) {
      await fs.copyFile(path.join(dataDir, f), path.join(dest, f))
    }
    console.log(`Backup copied to: ${dest}`)
  }

  const ageRecipient = process.env.AGE_RECIPIENT?.trim()
  if (ageRecipient && existsSync(gzPath)) {
    try {
      execFileSync(
        'age',
        ['-r', ageRecipient, '-o', `${gzPath}.age`, gzPath],
        { stdio: 'inherit' },
      )
      console.log(`Age-encrypted: ${gzPath}.age`)
    } catch {
      console.warn(
        'AGE_RECIPIENT set but age CLI failed; install age for encryption.',
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
