import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function isReadWritable(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK | constants.W_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Writes through a hidden temp file in the same folder and renames it into place, so readers
 * (and other apps watching the folder) never see a half-written file.
 */
export async function writeFileAtomic(path: string, data: string | Uint8Array): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  const temp = join(dir, `.${basename(path)}.${randomBytes(4).toString('hex')}.tmp`)
  try {
    await writeFile(temp, data)
    await rename(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

/** `dir/name.ext`, or `dir/name-2.ext`, `dir/name-3.ext`… when the name is taken. */
export async function uniquePath(dir: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const stem = basename(fileName, ext) || 'file'
  let candidate = join(dir, `${stem}${ext}`)
  for (let n = 2; await pathExists(candidate); n++) candidate = join(dir, `${stem}-${n}${ext}`)
  return candidate
}

/** Dotfiles and editor temp files are never treated as wiki pages or sources. */
export function isHiddenName(name: string): boolean {
  return name.startsWith('.') || name.endsWith('~')
}
