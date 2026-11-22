# Genera il QR di anteprima con una versione NUOVA ogni volta (codice +1, nome 1.0.N), così l'app Zepp sostituisce quella già installata.
# La versione compare anche sull'orologio (riga piccola in basso) per controllare che sia quella giusta.
$cartella = Split-Path -Parent $MyInvocation.MyCommand.Path
$appJson = Join-Path $cartella 'app.json'
$pagina = Join-Path $cartella 'page\index.js'
$json = Get-Content $appJson -Raw -Encoding UTF8
$m = [regex]::Match($json, '"version":\s*\{\s*"code":\s*(\d+),\s*"name":\s*"([^"]+)"\s*\}')
if (-not $m.Success) { throw 'versione non trovata in app.json' }
$codice = [int]$m.Groups[1].Value + 1
$nome = '1.0.' + $codice
$json = $json.Replace($m.Value, '"version": { "code": ' + $codice + ', "name": "' + $nome + '" }')
[System.IO.File]::WriteAllText($appJson, $json, (New-Object System.Text.UTF8Encoding($false)))
$js = Get-Content $pagina -Raw -Encoding UTF8
$js = [regex]::Replace($js, "const VERSIONE = '[^']*'", "const VERSIONE = '$nome'")
[System.IO.File]::WriteAllText($pagina, $js, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Versione $nome"
Set-Location $cartella
zeus preview
