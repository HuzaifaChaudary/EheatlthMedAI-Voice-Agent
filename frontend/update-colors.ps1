# PowerShell script to update blue colors to slate/teal
$files = Get-ChildItem -Path "app" -Recurse -Filter "*.tsx"

$replacements = @{
    'from-blue-600 via-blue-700 to-blue-800' = 'from-slate-800 via-slate-900 to-slate-950'
    'text-blue-200' = 'text-slate-300'
    'text-blue-100' = 'text-slate-200'
    'text-blue-300' = 'text-teal-300'
    'text-blue-400' = 'text-teal-400'
    'text-blue-600' = 'text-teal-600'
    'text-blue-700' = 'text-teal-700'
    'hover:text-blue-200' = 'hover:text-slate-300'
    'hover:text-blue-700' = 'hover:text-teal-700'
    'bg-blue-500' = 'bg-teal-600'
    'bg-blue-600' = 'bg-teal-600'
    'bg-blue-700' = 'bg-teal-700'
    'bg-blue-800' = 'bg-slate-800'
    'bg-blue-900' = 'bg-slate-900'
    'hover:bg-blue-500' = 'hover:bg-teal-700'
    'hover:bg-blue-600' = 'hover:bg-teal-700'
    'hover:bg-blue-700' = 'hover:bg-teal-800'
    'bg-blue-400/30' = 'bg-teal-500/30'
    'bg-blue-500/50' = 'bg-teal-600/50'
    'bg-blue-800/50' = 'bg-slate-800/60'
    'bg-blue-900' = 'bg-slate-900'
    'border-blue-400' = 'border-teal-500'
    'border-blue-500' = 'border-teal-600'
    'border-blue-700' = 'border-slate-700'
    'border-blue-700/50' = 'border-slate-700/50'
}

$count = 0
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $original = $content
    
    foreach ($key in $replacements.Keys) {
        $content = $content -replace $key, $replacements[$key]
    }
    
    if ($content -ne $original) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        Write-Host "Updated: $($file.FullName)"
        $count++
    }
}

Write-Host "`nTotal files updated: $count"

