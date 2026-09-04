Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-Condition {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw "Compose verification failed: $Message"
  }
}

function Get-ServiceEnvironment {
  param([hashtable]$Service)

  Assert-Condition ($null -ne $Service.environment) 'service is missing environment variables'
  return $Service.environment
}

$rendered = & docker compose config --format json 2>&1
Assert-Condition ($LASTEXITCODE -eq 0) "docker compose config failed: $($rendered -join "`n")"
$compose = ($rendered -join "`n") | ConvertFrom-Json -AsHashtable

foreach ($serviceName in @('postgres', 'redis', 'api', 'worker', 'web')) {
  Assert-Condition $compose.services.ContainsKey($serviceName) "missing '$serviceName' service"
}

$apiEnvironment = Get-ServiceEnvironment $compose.services.api
$workerEnvironment = Get-ServiceEnvironment $compose.services.worker

foreach ($environment in @($apiEnvironment, $workerEnvironment)) {
  Assert-Condition ($environment.DATABASE_URL -match '@postgres:5432/') 'DATABASE_URL must use the postgres service host'
  Assert-Condition ($environment.REDIS_HOST -eq 'redis') 'REDIS_HOST must use the redis service host'
  Assert-Condition ($environment.REDIS_URL -match 'redis://redis:6379') 'REDIS_URL must use the redis service host'
}

Assert-Condition ($workerEnvironment.API_BASE_URL -match '^http://api:3000') 'worker API_BASE_URL must use the api service host'
Assert-Condition ($null -ne $compose.services.web.ports) 'web service must publish a browser port'
Assert-Condition ($null -ne $compose.services.api.healthcheck) 'api service must define a health check'
Assert-Condition ($null -ne $compose.services.web.healthcheck) 'web service must define a health check'

$migrationFiles = Get-ChildItem 'apps/api/prisma/migrations' -Directory |
  ForEach-Object { Join-Path $_.FullName 'migration.sql' } |
  Where-Object { Test-Path $_ }
$timeSeriesMigration = $migrationFiles | Where-Object {
  $content = Get-Content -Raw $_
  $content -match 'CREATE TABLE IF NOT EXISTS energy_record' -and
  $content -match 'CREATE MATERIALIZED VIEW IF NOT EXISTS generation_daily_stat'
}
Assert-Condition ($null -ne $timeSeriesMigration) 'missing formal time-series Prisma migration'

Write-Output 'Compose configuration verified.'
