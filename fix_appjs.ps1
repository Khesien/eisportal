$inputPath = 'c:\Users\DIT\OneDrive\Desktop\dr\EIS-Portal\app.js'
$content = [System.IO.File]::ReadAllText($inputPath, [System.Text.Encoding]::UTF8)

# Fix the broken URL (supabase.co was changed to _sb.co)
$content = $content.Replace('https://lpulcmxkaojmmuvjzsck._sb.co', 'https://lpulcmxkaojmmuvjzsck.supabase.co')

# Fix the broken window._sb.createClient (should be window.supabase.createClient)
$content = $content.Replace('window._sb.createClient', 'window.supabase.createClient')

[System.IO.File]::WriteAllText($inputPath, $content, [System.Text.Encoding]::UTF8)

Write-Host "Fixed!"
Write-Host ("URL correct: " + $content.Contains("supabase.co"))
Write-Host ("window.supabase.createClient: " + $content.Contains("window.supabase.createClient"))
Write-Host ("_sb.auth: " + $content.Contains("_sb.auth"))
Write-Host ("_sb.from: " + $content.Contains("_sb.from"))
Write-Host ("No more supabase. in JS (should be 0 except URL and init): " + ($content -split "`n" | Where-Object { $_ -match '\bsupabase\.' -and $_ -notmatch 'supabase\.co' -and $_ -notmatch 'window\.supabase' -and $_ -notmatch '//' } | Measure-Object).Count)
