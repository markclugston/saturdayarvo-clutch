import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const containerName = 'clutch-e2e-sql-ownership'
const certificatePath = path.join(os.tmpdir(), 'clutch-e2e-ownership.pfx')

export default async function cleanupTestApi() {
  try {
    const containers = run('docker', [
      'ps',
      '--all',
      '--quiet',
      '--filter',
      `name=^${containerName}$`,
    ])
    const containerIds = containers.trim().split(/\s+/).filter(Boolean)
    if (containerIds.length > 0) {
      run('docker', ['rm', '--force', ...containerIds])
    }
  } finally {
    rmSync(certificatePath, { force: true })
  }
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    windowsHide: true,
  })
  if (result.error || result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(
      `${command} ${args.join(' ')} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}${output ? `\n${output}` : ''}`,
    )
  }
  return result.stdout
}
