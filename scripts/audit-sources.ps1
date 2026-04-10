$chunksDir = "c:\AI Projects\01_Apps\Somni\corpus\chunks"
$nonAuPatterns = @('babycenter', 'pampers', 'huckleberry', 'healthychildren', 'sleepfoundation', 'whattoexpect', 'webmd', 'healthline', 'clevelandclinic', 'nhs.uk')
$regex = ($nonAuPatterns | ForEach-Object { [regex]::Escape($_) }) -join '|'

Get-ChildItem "$chunksDir\*.md" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $name = $_.Name
    $matches = [regex]::Matches($content, $regex, 'IgnoreCase')
    if ($matches.Count -gt 0) {
        $found = ($matches | ForEach-Object { $_.Value }) | Sort-Object -Unique
        Write-Output "$name => $($found -join ', ')"
    }
}
