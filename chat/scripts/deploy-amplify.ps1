# Deploy Sheldon (chat/) to AWS Amplify Hosting (Next.js SSR / WEB_COMPUTE)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File chat/scripts/deploy-amplify.ps1
#   powershell -ExecutionPolicy Bypass -File chat/scripts/deploy-amplify.ps1 -AppId abc123

param(
    [string]$AppName = "sheldon",
    [string]$BranchName = "main",
    [string]$AppId = "",
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$EnvFile = Join-Path $RepoRoot "chat\.env.local"

function Read-EnvFile([string]$Path) {
    $vars = @{}
    if (-not (Test-Path $Path)) { return $vars }
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
        $k, $v = $_ -split '=', 2
        $vars[$k.Trim()] = $v.Trim()
    }
    return $vars
}

function Write-JsonFile([string]$Path, [object]$Object) {
    $json = $Object | ConvertTo-Json -Depth 5
    [System.IO.File]::WriteAllText($Path, $json, [System.Text.UTF8Encoding]::new($false))
}

function Build-EnvObject([hashtable]$Vars) {
    $envObj = @{}
    foreach ($key in $Vars.Keys) {
        if (-not [string]::IsNullOrWhiteSpace($Vars[$key])) {
            $envObj[$key] = [string]$Vars[$key]
        }
    }
    return $envObj
}

$local = Read-EnvFile $EnvFile
$apiUrl = ($local["NEXT_PUBLIC_API_URL"] -replace '/$', '')
$poolId = $local["NEXT_PUBLIC_COGNITO_USER_POOL_ID"]
$clientId = $local["NEXT_PUBLIC_COGNITO_CLIENT_ID"]
$awsRegion = $local["NEXT_PUBLIC_AWS_REGION"]
$bucket = $local["S3_BUCKET_NAME"]
$clientSecret = $local["COGNITO_CLIENT_SECRET"]

if (-not $apiUrl -or -not $poolId -or -not $clientId -or -not $bucket) {
    throw "Fill chat/.env.local before deploying (API URL, Cognito IDs, S3_BUCKET_NAME)."
}

$envObj = Build-EnvObject @{
    AMPLIFY_MONOREPO_APP_ROOT = "chat"
    NEXT_PUBLIC_API_URL = $apiUrl
    NEXT_PUBLIC_COGNITO_USER_POOL_ID = $poolId
    NEXT_PUBLIC_COGNITO_CLIENT_ID = $clientId
    NEXT_PUBLIC_AWS_REGION = $awsRegion
    S3_BUCKET_NAME = $bucket
    COGNITO_CLIENT_SECRET = $clientSecret
}

if (-not $AppId) {
    Write-Host "Creating Amplify app '$AppName' (WEB_COMPUTE)..."
    $createInputPath = Join-Path $env:TEMP "sheldon-amplify-create.json"
    Write-JsonFile $createInputPath @{
        name = $AppName
        platform = "WEB_COMPUTE"
        environmentVariables = $envObj
    }
    $createUri = "file://" + ($createInputPath -replace '\\', '/')

    $createJson = aws amplify create-app --cli-input-json $createUri --region $Region --output json
    if ($LASTEXITCODE -ne 0) { throw "create-app failed" }
    $AppId = ($createJson | ConvertFrom-Json).app.appId
    Write-Host "  AppId: $AppId"
} else {
    Write-Host "Updating environment variables on app $AppId..."
    $updateInputPath = Join-Path $env:TEMP "sheldon-amplify-update.json"
    Write-JsonFile $updateInputPath @{
        appId = $AppId
        environmentVariables = $envObj
    }
    $updateUri = "file://" + ($updateInputPath -replace '\\', '/')
    aws amplify update-app --cli-input-json $updateUri --region $Region | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "update-app failed" }
}

Write-Host "Ensuring branch '$BranchName' exists..."
$branchesJson = aws amplify list-branches --app-id $AppId --region $Region --output json
$branch = ($branchesJson | ConvertFrom-Json).branches | Where-Object { $_.branchName -eq $BranchName } | Select-Object -First 1
if (-not $branch) {
    aws amplify create-branch `
        --app-id $AppId `
        --branch-name $BranchName `
        --stage PRODUCTION `
        --enable-auto-build `
        --region $Region | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "create-branch failed" }
    Write-Host "  Branch created."
} else {
    Write-Host "  Branch already exists."
}

Write-Host ""
Write-Host "Amplify app is ready for Git-connected deploy."
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Initialize git and push this repo to GitHub/CodeCommit"
Write-Host "  2. Connect the repository in Amplify console for app $AppId"
Write-Host "  3. Attach chat/scripts/amplify-compute-policy.json to the Amplify SSR compute role"
Write-Host "  4. Trigger a build: aws amplify start-job --app-id $AppId --branch-name $BranchName --job-type RELEASE --region $Region"
Write-Host ""
$domain = aws amplify get-app --app-id $AppId --region $Region --query "app.defaultDomain" --output text
Write-Host "App URL (after first deploy): https://$BranchName.$domain"
Write-Host "Console: https://$Region.console.aws.amazon.com/amplify/apps/$AppId"
