# SnapVerse — deploy Firestore rules + indexes (fixes PATH for firebase/npm)
$ErrorActionPreference = "Stop"

$nodeDir = "C:\Program Files\nodejs"
$npmGlobal = "$env:APPDATA\npm"
$env:Path = "$nodeDir;$npmGlobal;" + $env:Path

$firebase = Join-Path $npmGlobal "firebase.cmd"
if (-not (Test-Path $firebase)) {
  Write-Host "Firebase CLI not found. Installing..." -ForegroundColor Yellow
  & (Join-Path $nodeDir "npm.cmd") install -g firebase-tools
}

Set-Location $PSScriptRoot

Write-Host "Firebase version:" -ForegroundColor Cyan
& $firebase --version

Write-Host ""
Write-Host "Step 1: If not logged in yet, run:" -ForegroundColor Yellow
Write-Host "  & '$firebase' login" -ForegroundColor White
Write-Host ""
Write-Host "Step 2: Deploying Firestore rules and indexes..." -ForegroundColor Cyan
& $firebase use snapverse-32683
& $firebase deploy --only firestore

Write-Host ""
Write-Host "Done. Also add murray-shot-it.netlify.app under Firebase Auth -> Authorized domains." -ForegroundColor Green
