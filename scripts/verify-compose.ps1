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
  Assert-Condition (-not $compose.services[$serviceName].ContainsKey('container_name')) "'$serviceName' must not use a global container_name"
}

$apiEnvironment = Get-ServiceEnvironment $compose.services.api
$workerEnvironment = Get-ServiceEnvironment $compose.services.worker

Assert-Condition ($apiEnvironment.NODE_ENV -ne 'production') 'default Compose API runtime must permit the local Mock-payment demo'
Assert-Condition ($apiEnvironment.MOCK_PAYMENT_DEMO_ENABLED -eq 'true') 'default Compose API runtime must enable the controlled Mock-payment demo'

foreach ($environment in @($apiEnvironment, $workerEnvironment)) {
  Assert-Condition ($environment.DATABASE_URL -match '@postgres:5432/') 'DATABASE_URL must use the postgres service host'
  Assert-Condition ($environment.REDIS_HOST -eq 'redis') 'REDIS_HOST must use the redis service host'
  Assert-Condition ($environment.REDIS_URL -match 'redis://redis:6379') 'REDIS_URL must use the redis service host'
}

Assert-Condition ($workerEnvironment.API_BASE_URL -match '^http://api:3000') 'worker API_BASE_URL must use the api service host'
Assert-Condition ($null -ne $compose.services.web.ports) 'web service must publish a browser port'
Assert-Condition ($null -ne $compose.services.api.healthcheck) 'api service must define a health check'
Assert-Condition ($null -ne $compose.services.web.healthcheck) 'web service must define a health check'

$productionRendered = & docker compose --env-file .env.production.example -f docker-compose.yml -f docker-compose.production.yml config --format json 2>&1
Assert-Condition ($LASTEXITCODE -eq 0) "production Compose config failed: $($productionRendered -join "`n")"
$production = ($productionRendered -join "`n") | ConvertFrom-Json -AsHashtable

foreach ($serviceName in @('postgres', 'redis', 'api')) {
  Assert-Condition (-not $production.services[$serviceName].ContainsKey('ports')) "production '$serviceName' must not publish a host port"
}

foreach ($serviceName in @('postgres', 'redis', 'api', 'worker', 'web')) {
  $productionService = $production.services[$serviceName]
  Assert-Condition ($productionService.ContainsKey('restart') -and $productionService.restart -eq 'unless-stopped') "production '$serviceName' must restart after a VPS reboot"
}

$productionPostgres = $production.services.postgres.environment
$productionApi = $production.services.api.environment
$productionWorker = $production.services.worker.environment
$productionWebPorts = @($production.services.web.ports)

Assert-Condition ($productionPostgres.POSTGRES_PASSWORD -eq 'production-db-password') 'production database password must come from the production environment file'
Assert-Condition ($productionApi.DATABASE_URL -match 'production-db-password') 'production API DATABASE_URL must use the configured database password'
Assert-Condition ($productionWorker.DATABASE_URL -match 'production-db-password') 'production worker DATABASE_URL must use the configured database password'
Assert-Condition ($productionApi.NODE_ENV -eq 'production') 'production API must run with NODE_ENV=production'
Assert-Condition ($productionApi.MOCK_PAYMENT_DEMO_ENABLED -eq 'false') 'production API must disable Mock-payment completion'
Assert-Condition ($productionWebPorts.Count -eq 1) 'production web must publish exactly one host port'
Assert-Condition ($productionWebPorts[0].host_ip -eq '127.0.0.1') 'production web must bind to loopback only'
Assert-Condition ($productionWebPorts[0].published -eq '8080') 'production web must publish port 8080 for the local reverse proxy'

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
