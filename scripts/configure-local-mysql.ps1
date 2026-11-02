$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
$envPath = Join-Path $projectPath '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    throw 'Missing .env; copy .env.example first and configure JWT_SECRET.'
}
function Read-EncodedPassword([string] $prompt) {
    $secretValue = Read-Host $prompt -AsSecureString
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secretValue)
    try {
        $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
        if ([string]::IsNullOrEmpty($plainValue)) { throw 'Password must not be empty' }
        return [Uri]::EscapeDataString($plainValue)
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
        $plainValue = $null
        $secretValue.Dispose()
    }
}
# Run only after these project accounts have been created and verified by you.
$devPassword = Read-EncodedPassword 'Password for airbnb_local_app (hidden)'
$testPassword = Read-EncodedPassword 'Password for airbnb_test_app (hidden)'
$devUrl = 'mysql://airbnb_local_app:' + $devPassword + '@127.0.0.1:3306/airbnb_capstone_local'
$testUrl = 'mysql://airbnb_test_app:' + $testPassword + '@127.0.0.1:3306/airbnb_capstone_test'
$text = [IO.File]::ReadAllText($envPath)
foreach ($entry in @(@('DATABASE_URL', $devUrl), @('TEST_DATABASE_URL', $testUrl))) {
    $pattern = '(?m)^' + $entry[0] + '=.*$'
    $newLine = $entry[0] + '=' + $entry[1]
    if ([regex]::IsMatch($text, $pattern)) {
        $replacementLine = $newLine
        $text = [regex]::Replace($text, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $replacementLine })
    } else { $text = $text.TrimEnd() + [Environment]::NewLine + $newLine + [Environment]::NewLine }
}
[IO.File]::WriteAllText($envPath, $text, [Text.UTF8Encoding]::new($false))
$text = $devUrl = $testUrl = $devPassword = $testPassword = $null
Write-Output 'Updated only DATABASE_URL and TEST_DATABASE_URL in .env. No connection attempted; JWT and other settings preserved.'
