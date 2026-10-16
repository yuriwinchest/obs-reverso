$ErrorActionPreference = 'Stop'
$taskRoot = $PSScriptRoot
$taskExecutable = Join-Path $taskRoot 'release\win-unpacked\OBS Reverso.exe'
if (Test-Path -LiteralPath $taskExecutable) {
    Start-Process -FilePath $taskExecutable -WorkingDirectory (Split-Path -Parent $taskExecutable) -WindowStyle Hidden
    exit 0
}
Set-Location -LiteralPath $taskRoot
if (-not (Test-Path -LiteralPath 'node_modules\electron\dist\electron.exe')) {
    throw 'Dependências ausentes. Execute npm ci, npm run assets e npm run build nesta pasta.'
}
if (-not (Test-Path -LiteralPath 'dist-electron\main.cjs')) {
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível compilar o aplicativo.' }
}
Start-Process -FilePath (Join-Path $taskRoot 'node_modules\electron\dist\electron.exe') -ArgumentList ('"' + $taskRoot + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden
