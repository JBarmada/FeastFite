# k8s/create-secrets.ps1
# Reads k8s/secrets.env and creates all Kubernetes secrets in the feastfite namespace.
# Safe to re-run - existing secrets are updated.
#
# Usage:
#   powershell -File k8s/create-secrets.ps1

$ErrorActionPreference = "Stop"

# 1. Check secrets.env exists
$envFile = Join-Path $PSScriptRoot "secrets.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: Missing k8s/secrets.env" -ForegroundColor Red
    Write-Host "Run: copy k8s\secrets.env.example k8s\secrets.env  then fill in passwords."
    exit 1
}

# 2. Parse secrets.env
$cfg = @{}
foreach ($line in (Get-Content $envFile)) {
    $line = $line.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line -split '=', 2
        if ($parts.Length -eq 2) {
            $cfg[$parts[0].Trim()] = $parts[1].Trim()
        }
    }
}

$PG_PASSWORD    = $cfg['PG_PASSWORD']
$RMQ_PASSWORD   = $cfg['RMQ_PASSWORD']
$MINIO_PASSWORD = $cfg['MINIO_PASSWORD']

# 3. Validate no CHANGE_ME values
$bad = @()
if (-not $PG_PASSWORD    -or $PG_PASSWORD    -eq 'CHANGE_ME') { $bad += 'PG_PASSWORD' }
if (-not $RMQ_PASSWORD   -or $RMQ_PASSWORD   -eq 'CHANGE_ME') { $bad += 'RMQ_PASSWORD' }
if (-not $MINIO_PASSWORD -or $MINIO_PASSWORD -eq 'CHANGE_ME') { $bad += 'MINIO_PASSWORD' }
if ($bad.Count -gt 0) {
    Write-Host "ERROR: Replace CHANGE_ME for: $($bad -join ', ') in k8s/secrets.env" -ForegroundColor Red
    exit 1
}

# 4. Generate JWT secret
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$JWT = [System.Convert]::ToBase64String($bytes)
Write-Host "Generated JWT secret." -ForegroundColor Green

# 5. Apply namespace
Write-Host "Applying namespace..." -ForegroundColor Cyan
kubectl apply -f (Join-Path $PSScriptRoot "namespace.yml")

# 6. Create secrets (dry-run + apply = create or update)
Write-Host "Creating secrets..." -ForegroundColor Cyan

kubectl create secret generic postgres-credentials `
    --from-literal=username=feastfite `
    --from-literal=password=$PG_PASSWORD `
    -n feastfite --save-config --dry-run=client -o yaml | kubectl apply -f -
Write-Host "  postgres-credentials OK" -ForegroundColor Green

kubectl create secret generic jwt-secret `
    --from-literal=secret=$JWT `
    -n feastfite --save-config --dry-run=client -o yaml | kubectl apply -f -
Write-Host "  jwt-secret OK" -ForegroundColor Green

kubectl create secret generic rabbitmq-credentials `
    --from-literal=username=feastfite `
    --from-literal=password=$RMQ_PASSWORD `
    -n feastfite --save-config --dry-run=client -o yaml | kubectl apply -f -
Write-Host "  rabbitmq-credentials OK" -ForegroundColor Green

kubectl create secret generic minio-credentials `
    --from-literal=access-key=feastfite `
    --from-literal=secret-key=$MINIO_PASSWORD `
    -n feastfite --save-config --dry-run=client -o yaml | kubectl apply -f -
Write-Host "  minio-credentials OK" -ForegroundColor Green

# 7. Verify
Write-Host ""
Write-Host "All secrets in feastfite namespace:" -ForegroundColor Cyan
kubectl get secrets -n feastfite
