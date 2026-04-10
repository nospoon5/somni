$chunksDir = "c:\AI Projects\01_Apps\Somni\corpus\chunks"
$cutoff = [datetime]"2026-04-09"

Write-Output "=== Chunks modified after $cutoff ==="
Get-ChildItem "$chunksDir\*.md" | Where-Object { $_.LastWriteTime -gt $cutoff } | Sort-Object LastWriteTime | ForEach-Object {
    Write-Output "$($_.Name)  =>  $($_.LastWriteTime)"
}

Write-Output ""
Write-Output "=== All chunks by last_updated frontmatter ==="
Get-ChildItem "$chunksDir\*.md" | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    if ($content -match 'last_updated:\s*"?(\d{4}-\d{2}-\d{2})') {
        $lastUpdated = $matches[1]
        Write-Output "$($_.Name)  =>  $lastUpdated"
    } else {
        Write-Output "$($_.Name)  =>  NO_DATE"
    }
} | Sort-Object
