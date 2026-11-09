import { randomBytes } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const apiProject = path.join(repositoryRoot, 'src', 'Clutch.API', 'Clutch.API.csproj')
const apiAssembly = path.join(repositoryRoot, 'src', 'Clutch.API', 'bin', 'Debug', 'net10.0', 'Clutch.API.dll')
const containerName = 'clutch-e2e-sql-ownership'
const password = `ClutchE2e!${randomBytes(18).toString('hex')}Aa9`
const certificatePath = path.join(os.tmpdir(), 'clutch-e2e-ownership.pfx')
const certificatePassword = randomBytes(24).toString('hex')
let apiProcess
let apiEnvironment

try {
  const sqlPort = await startSqlServer()
  run('dotnet', [
    'dev-certs',
    'https',
    '--export-path',
    certificatePath,
    '--format',
    'Pfx',
    '--password',
    certificatePassword,
  ])
  apiEnvironment = {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    ASPNETCORE_URLS: 'https://localhost:7180',
    ASPNETCORE_Kestrel__Certificates__Default__Path: certificatePath,
    ASPNETCORE_Kestrel__Certificates__Default__Password: certificatePassword,
    'Logging__LogLevel__Microsoft.EntityFrameworkCore.Database.Command': 'Warning',
    ConnectionStrings__Clutch: `Server=127.0.0.1,${sqlPort};Database=ClutchE2E;User Id=sa;Password=${password};TrustServerCertificate=True;Encrypt=False`,
  }
  await applyMigrations()
  apiProcess = spawn('dotnet', [apiAssembly], {
    cwd: path.dirname(apiProject),
    env: apiEnvironment,
    stdio: 'inherit',
  })

  const exitCode = await new Promise((resolve, reject) => {
    apiProcess.once('error', reject)
    apiProcess.once('close', resolve)
  })
  if (exitCode !== 0) {
    throw new Error(`Test API exited with code ${exitCode}.`)
  }
} finally {
  if (apiProcess && apiProcess.exitCode === null) {
    const apiClosed = new Promise((resolve) => apiProcess.once('close', resolve))
    apiProcess.kill()
    await apiClosed
  }
  run('docker', ['rm', '--force', containerName], { allowFailure: true })
  rmSync(certificatePath, { force: true })
}

async function startSqlServer() {
  run('docker', [
    'run',
    '--detach',
    '--rm',
    '--name',
    containerName,
    '--publish',
    '127.0.0.1::1433',
    '--env',
    'ACCEPT_EULA=Y',
    '--env',
    'MSSQL_PID=Developer',
    '--env',
    'MSSQL_SA_PASSWORD',
    'mcr.microsoft.com/mssql/server:2022-latest',
  ], { env: { ...process.env, MSSQL_SA_PASSWORD: password } })

  const portMapping = run('docker', ['port', containerName, '1433/tcp'])
  const port = Number(portMapping.trim().split(':').at(-1))
  if (!Number.isInteger(port) || port < 1) {
    throw new Error(`Could not determine the SQL Server host port from "${portMapping.trim()}".`)
  }
  return port
}

async function applyMigrations() {
  const deadline = Date.now() + 120_000
  let lastError
  while (Date.now() < deadline) {
    try {
      run('dotnet', ['ef', 'database', 'update', '--project', apiProject], {
        cwd: repositoryRoot,
        env: apiEnvironment,
      })
      return
    } catch (error) {
      lastError = error
      await setTimeout(2_000)
    }
  }
  throw new Error('SQL Server did not become ready for EF migrations within 120 seconds.', {
    cause: lastError,
  })
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: 'utf8',
    timeout: options.timeout ?? 60_000,
    windowsHide: true,
  })
  if (result.error || result.status !== 0) {
    if (options.allowFailure) return ''
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(
      `${command} ${args.join(' ')} failed${result.error ? `: ${result.error.message}` : ` (exit ${result.status})`}${output ? `\n${output}` : ''}`,
    )
  }
  return result.stdout
}

process.on('SIGINT', () => apiProcess?.kill('SIGINT'))
process.on('SIGTERM', () => apiProcess?.kill('SIGTERM'))
