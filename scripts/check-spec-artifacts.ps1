<#
.SYNOPSIS
    Mechanical checks of a feature's spec.md, plan.md and tasks.md.

.DESCRIPTION
    Replaces checks an agent would otherwise make by reading the files.

    ERROR (exit 1):
      - a required file is missing
      - an FR is defined twice, or no task cites it
      - a task is malformed, a task ID repeats, or a user story task has no [US#]
      - a constitution ID is missing from the plan's Constitution Check
      - a PENDING Constitution Check ID is cited by no task
      - a template placeholder or open marker remains
    WARN (exit code unchanged):
      - a success criterion no task cites, long tasks, large documents

    IDs may be written as FR-001, as a list (FR-007/008/009) or as a range (SEC-001..003).

.PARAMETER FeatureDir
    Feature folder. Defaults to the one in .specify/feature.json.

.EXAMPLE
    .\scripts\check-spec-artifacts.ps1
.EXAMPLE
    .\scripts\check-spec-artifacts.ps1 -FeatureDir specs/029-asset-register
#>
[CmdletBinding()]
param(
    [string]$FeatureDir,
    [string]$Root,
    [int]$MaxTaskLength = 220,
    [int]$MaxTotalKB = 35
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Not a parameter default: under "powershell -File", $PSScriptRoot is empty there.
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }

$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Read-Text([string]$Path) {
    [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8)
}

# Every ID in the text, with lists (A-001/002) and ranges (A-001..003) expanded.
function Get-Ids([string]$Text) {
    $ids = @{}
    # The en dash is built from its code: Windows PowerShell misreads it as a literal in this file.
    $separators = '/|\.\.|' + [char]0x2013
    $pattern = '\b(?<p>[A-Z]{2,3})-(?<n>\d{3})(?<s>[a-z]?)(?<rest>(?:\s*(?:' + $separators + ')\s*(?:[A-Z]{2,3}-)?\d{3}[a-z]?)*)'
    $partPattern = '(?<sep>' + $separators + ')\s*(?:(?<p>[A-Z]{2,3})-)?(?<n>\d{3})(?<s>[a-z]?)'
    foreach ($m in [regex]::Matches($Text, $pattern)) {
        $prefix = $m.Groups['p'].Value
        $last = [int]$m.Groups['n'].Value
        $ids["$prefix-$($m.Groups['n'].Value)$($m.Groups['s'].Value)"] = $true
        foreach ($part in [regex]::Matches($m.Groups['rest'].Value, $partPattern)) {
            if ($part.Groups['p'].Success) { $prefix = $part.Groups['p'].Value }
            $next = [int]$part.Groups['n'].Value
            if ($part.Groups['sep'].Value -ne '/') {
                for ($i = $last + 1; $i -lt $next; $i++) { $ids[('{0}-{1:000}' -f $prefix, $i)] = $true }
            }
            $ids[('{0}-{1:000}{2}' -f $prefix, $next, $part.Groups['s'].Value)] = $true
            $last = $next
        }
    }
    $ids
}

if (-not $FeatureDir) {
    $featureJson = Join-Path $Root '.specify/feature.json'
    if (-not (Test-Path $featureJson)) { Write-Host 'ERROR no .specify/feature.json; pass -FeatureDir'; exit 1 }
    $FeatureDir = (Read-Text $featureJson | ConvertFrom-Json).feature_directory
}
if (-not [IO.Path]::IsPathRooted($FeatureDir)) { $FeatureDir = Join-Path $Root $FeatureDir }

$text = @{}
$bytes = 0
foreach ($name in 'spec', 'plan', 'tasks') {
    $path = Join-Path $FeatureDir "$name.md"
    if (-not (Test-Path $path)) { $errors.Add("$name.md is missing"); continue }
    $bytes += (Get-Item $path).Length
    # HTML comments hold template guidance, not content.
    $text[$name] = [regex]::Replace((Read-Text $path), '(?s)<!--.*?-->', '')
}

if ($errors.Count -eq 0) {
    # Placeholders
    $markers = '\[NEEDS CLARIFICATION', 'NEEDS CLARIFICATION:', '\bTXXX\b', '\bTODO\b', '\bTKTK\b', '\?\?\?',
        '\[FEATURE', '\[###', '\[DATE\]', '\[Brief Title\]', '\[ID \(reason\)'
    foreach ($name in 'spec', 'plan', 'tasks') {
        foreach ($marker in $markers) {
            $found = [regex]::Match($text[$name], $marker)
            if ($found.Success) { $errors.Add("$name.md still contains '$($found.Value)'") }
        }
    }

    # Requirement coverage
    $defined = @([regex]::Matches($text.spec, '(?m)^\s*-\s*\*\*(?<id>(?:FR|SC)-\d{3}[a-z]?)\*\*') |
        ForEach-Object { $_.Groups['id'].Value })
    if (-not ($defined -like 'FR-*')) { $errors.Add('spec.md defines no requirements as "- **FR-001**:"') }
    $defined | Group-Object | Where-Object { $_.Count -gt 1 -and $_.Name -like 'FR-*' } |
        ForEach-Object { $errors.Add("spec.md defines $($_.Name) $($_.Count) times") }
    $cited = Get-Ids $text.tasks
    $uncovered = @($defined | Sort-Object -Unique | Where-Object { -not $cited.ContainsKey($_) })
    $frs = @($uncovered | Where-Object { $_ -like 'FR-*' })
    $scs = @($uncovered | Where-Object { $_ -like 'SC-*' })
    if ($frs.Count) { $errors.Add("no task cites: $($frs -join ', ')") }
    if ($scs.Count) { $warnings.Add("no task cites (fine if nothing to build): $($scs -join ', ')") }

    # Task format
    $seen = @{}
    $long = @()
    $inStory = $false
    foreach ($line in ($text.tasks -split '\r?\n')) {
        if ($line -match '^##\s') { $inStory = $line -match 'User Story' }
        if ($line -notmatch '^\s*- \[') { continue }
        if ($line -notmatch '^- \[[ xX]\] (?<id>T\d{3,}) ') {
            $errors.Add("malformed task: $($line.Substring(0, [Math]::Min(60, $line.Length)))")
            continue
        }
        $id = $Matches['id']
        if ($seen.ContainsKey($id)) { $errors.Add("task ID $id is used twice") }
        $seen[$id] = $true
        if ($inStory -and $line -notmatch '\[US\d+\]') { $errors.Add("$id is in a user story phase but has no [US#]") }
        if ($line.Length -gt $MaxTaskLength) { $long += $id }
    }
    if ($seen.Count -eq 0) { $errors.Add('tasks.md has no tasks') }
    if ($long.Count) {
        $shown = ($long | Select-Object -First 10) -join ', '
        $warnings.Add("$($long.Count) task(s) over $MaxTaskLength characters: $shown$(if ($long.Count -gt 10) { ', ...' })")
    }

    # Constitution Check
    $section = [regex]::Match($text.plan, '(?ms)^## Constitution Check\s*$(?<body>.*?)(?=^## |\z)')
    if (-not $section.Success) {
        $errors.Add('plan.md has no "## Constitution Check" section')
    }
    else {
        $body = $section.Groups['body'].Value
        $constitution = Read-Text (Join-Path $Root '.specify/memory/constitution.md')
        $required = @([regex]::Matches($constitution, '(?m)^## (?<id>[A-Z]{3}-\d{3})\b') |
            ForEach-Object { $_.Groups['id'].Value })
        # Only table rows and the N/A line count, not prose that happens to name an ID.
        $rows = @($body -split '\r?\n' | Where-Object { $_ -match '^\s*\|' })
        $notApplicable = [regex]::Match($body, '(?ms)^N/A:.*?(?=\r?\n[ \t]*\r?\n|\z)').Value
        $listed = Get-Ids (($rows + $notApplicable) -join "`n")
        $missing = @($required | Where-Object { -not $listed.ContainsKey($_) })
        if ($missing.Count) { $errors.Add("Constitution Check omits: $($missing -join ', ')") }

        foreach ($row in [regex]::Matches($body, '(?m)^\|\s*(?<id>[A-Z]{3}-\d{3})\s*\|.*\|\s*PENDING[^|]*\|\s*$')) {
            $id = $row.Groups['id'].Value
            if (-not $cited.ContainsKey($id)) { $errors.Add("PENDING gate $id is cited by no task") }
        }
    }

    $kb = [Math]::Round($bytes / 1KB)
    if ($kb -gt $MaxTotalKB) { $warnings.Add("spec, plan and tasks total $kb KB (budget $MaxTotalKB KB)") }
}

foreach ($e in $errors) { Write-Host "ERROR $e" }
foreach ($w in $warnings) { Write-Host "WARN  $w" }
Write-Host "$(Split-Path -Leaf $FeatureDir): $($errors.Count) error(s), $($warnings.Count) warning(s)."
if ($errors.Count) { exit 1 }
exit 0
