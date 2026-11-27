<#
.SYNOPSIS
    Keeps the Claude Code and GitHub Copilot agent configuration in sync.

.DESCRIPTION
    Pairs kept in sync:
      .claude/skills/clutch-*/**   <->  .github/skills/clutch-*/**              (identical files)
      .claude/rules/<name>.md      <->  .github/instructions/<name>.instructions.md
                                        (same body; `paths:` list <-> `applyTo:` string)

      .claude/skills/speckit-*/SKILL.md -> .github/skills/speckit-*/SKILL.md
                                        (one way; Claude Code-only front matter removed)

    Spec Kit generates the .claude speckit-* skills, including the rules in presets/clutch.
    -From copilot never changes them.
    CLAUDE.md and .github/copilot-instructions.md are maintained by hand.

    Files that exist only on the target side are reported, never deleted.

.PARAMETER Check
    Report drift and exit 1 if any pair differs. Changes nothing.

.PARAMETER From
    Copy from this side to the other: 'claude' or 'copilot'.

.EXAMPLE
    .\scripts\sync-agent-config.ps1 -Check
.EXAMPLE
    .\scripts\sync-agent-config.ps1 -From claude
#>
[CmdletBinding(DefaultParameterSetName = 'Check')]
param(
    [Parameter(ParameterSetName = 'Check', Mandatory = $true)]
    [switch]$Check,

    [Parameter(ParameterSetName = 'Sync', Mandatory = $true)]
    [ValidateSet('claude', 'copilot')]
    [string]$From,

    [string]$Root
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Not a parameter default: under "powershell -File", $PSScriptRoot is empty there.
if (-not $Root) { $Root = Split-Path -Parent $PSScriptRoot }

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$Sides = @{
    claude  = @{ Skills = Join-Path $Root '.claude/skills';  Rules = Join-Path $Root '.claude/rules' }
    copilot = @{ Skills = Join-Path $Root '.github/skills';  Rules = Join-Path $Root '.github/instructions' }
}

function Get-RelativePath([string]$Base, [string]$Path) {
    $Path.Substring($Base.Length).TrimStart('\', '/').Replace('\', '/')
}

function Get-SkillFiles([string]$SkillsRoot) {
    $result = @{}
    if (-not (Test-Path $SkillsRoot)) { return $result }
    Get-ChildItem -Path $SkillsRoot -Directory -Filter 'clutch-*' | ForEach-Object {
        Get-ChildItem -Path $_.FullName -File -Recurse | ForEach-Object {
            $result[(Get-RelativePath $SkillsRoot $_.FullName)] = $_.FullName
        }
    }
    $result
}

function Split-FrontMatter([string]$Text, [string]$Path) {
    $m = [regex]::Match($Text, '\A---\r?\n(?<fm>.*?)\r?\n---\r?\n(?<body>.*)\z', 'Singleline')
    if (-not $m.Success) { throw "No front matter found in $Path" }
    @{ FrontMatter = $m.Groups['fm'].Value; Body = $m.Groups['body'].Value }
}

function Get-RulePatterns([string]$FrontMatter, [string]$Side, [string]$Path) {
    if ($Side -eq 'claude') {
        $patterns = @([regex]::Matches($FrontMatter, '(?m)^\s*-\s*"(?<p>[^"]+)"\s*$') |
            ForEach-Object { $_.Groups['p'].Value })
    }
    else {
        $m = [regex]::Match($FrontMatter, '(?m)^applyTo:\s*"(?<p>[^"]*)"\s*$')
        if (-not $m.Success) { throw "No applyTo in $Path" }
        $patterns = @($m.Groups['p'].Value.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    if ($patterns.Count -eq 0) { throw "No file patterns in $Path" }
    $patterns
}

function Format-Rule([string[]]$Patterns, [string]$Body, [string]$Side) {
    if ($Side -eq 'claude') {
        $lines = @('---', 'paths:') + ($Patterns | ForEach-Object { "  - `"$_`"" }) + @('---')
    }
    else {
        $lines = @('---', "applyTo: `"$($Patterns -join ',')`"", '---')
    }
    ($lines -join "`n") + "`n" + $Body
}

function Get-RuleFiles([string]$RulesRoot, [string]$Side) {
    $result = @{}
    if (-not (Test-Path $RulesRoot)) { return $result }
    $suffix = if ($Side -eq 'claude') { '.md' } else { '.instructions.md' }
    Get-ChildItem -Path $RulesRoot -File -Filter "*$suffix" | ForEach-Object {
        $name = $_.Name.Substring(0, $_.Name.Length - $suffix.Length)
        $result[$name] = $_.FullName
    }
    $result
}

function Get-RulePath([string]$RulesRoot, [string]$Name, [string]$Side) {
    $suffix = if ($Side -eq 'claude') { '.md' } else { '.instructions.md' }
    Join-Path $RulesRoot "$Name$suffix"
}

function Convert-Rule([string]$SourcePath, [string]$SourceSide, [string]$TargetSide) {
    $text = [IO.File]::ReadAllText($SourcePath)
    $parts = Split-FrontMatter $text $SourcePath
    $patterns = Get-RulePatterns $parts.FrontMatter $SourceSide $SourcePath
    Format-Rule $patterns $parts.Body $TargetSide
}

function Test-SameFile([string]$A, [string]$B) {
    (Get-FileHash -LiteralPath $A).Hash -eq (Get-FileHash -LiteralPath $B).Hash
}

function Write-TextFile([string]$Path, [string]$Text) {
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Get-SpeckitSkills([string]$SkillsRoot) {
    $result = @{}
    if (-not (Test-Path $SkillsRoot)) { return $result }
    Get-ChildItem -Path $SkillsRoot -Directory -Filter 'speckit-*' | ForEach-Object {
        $file = Join-Path $_.FullName 'SKILL.md'
        if (Test-Path $file) { $result[$_.Name] = $file }
    }
    $result
}

function Convert-SpeckitSkill([string]$SourcePath) {
    $text = [IO.File]::ReadAllText($SourcePath).Replace("`r`n", "`n")
    $parts = Split-FrontMatter $text $SourcePath
    $kept = $parts.FrontMatter -split "`n" |
        Where-Object { $_ -notmatch '^(argument-hint|user-invocable|disable-model-invocation):' }
    "---`n$($kept -join "`n")`n---`n" + $parts.Body
}

function Test-SpeckitCopy([string]$Path, [string]$Expected) {
    (Test-Path $Path) -and ([IO.File]::ReadAllText($Path).Replace("`r`n", "`n") -ceq $Expected)
}

# ---------------------------------------------------------------- check

if ($PSCmdlet.ParameterSetName -eq 'Check') {
    $problems = New-Object System.Collections.Generic.List[string]

    $claudeSkills = Get-SkillFiles $Sides.claude.Skills
    $copilotSkills = Get-SkillFiles $Sides.copilot.Skills
    foreach ($rel in ($claudeSkills.Keys + $copilotSkills.Keys | Sort-Object -Unique)) {
        if (-not $copilotSkills.ContainsKey($rel)) { $problems.Add("skill  only in .claude : $rel"); continue }
        if (-not $claudeSkills.ContainsKey($rel)) { $problems.Add("skill  only in .github : $rel"); continue }
        if (-not (Test-SameFile $claudeSkills[$rel] $copilotSkills[$rel])) { $problems.Add("skill  differs         : $rel") }
    }

    $claudeRules = Get-RuleFiles $Sides.claude.Rules 'claude'
    $copilotRules = Get-RuleFiles $Sides.copilot.Rules 'copilot'
    foreach ($name in ($claudeRules.Keys + $copilotRules.Keys | Sort-Object -Unique)) {
        if (-not $copilotRules.ContainsKey($name)) { $problems.Add("rule   only in .claude : $name"); continue }
        if (-not $claudeRules.ContainsKey($name)) { $problems.Add("rule   only in .github : $name"); continue }
        $expected = Convert-Rule $claudeRules[$name] 'claude' 'copilot'
        $actual = [IO.File]::ReadAllText($copilotRules[$name])
        if ($expected -cne $actual) { $problems.Add("rule   differs         : $name") }
    }

    $claudeSpeckit = Get-SpeckitSkills $Sides.claude.Skills
    $copilotSpeckit = Get-SpeckitSkills $Sides.copilot.Skills
    foreach ($name in ($claudeSpeckit.Keys + $copilotSpeckit.Keys | Sort-Object -Unique)) {
        if (-not $copilotSpeckit.ContainsKey($name)) { $problems.Add("speckit only in .claude : $name"); continue }
        if (-not $claudeSpeckit.ContainsKey($name)) { $problems.Add("speckit only in .github : $name"); continue }
        if (-not (Test-SpeckitCopy $copilotSpeckit[$name] (Convert-SpeckitSkill $claudeSpeckit[$name]))) {
            $problems.Add("speckit differs         : $name")
        }
    }

    if ($problems.Count -eq 0) {
        Write-Host 'Agent config in sync.'
        exit 0
    }
    Write-Host 'Agent config drift:'
    $problems | ForEach-Object { Write-Host "  $_" }
    Write-Host 'Fix with: .\scripts\sync-agent-config.ps1 -From claude   (or -From copilot)'
    exit 1
}

# ---------------------------------------------------------------- sync

$To = if ($From -eq 'claude') { 'copilot' } else { 'claude' }
$src = $Sides[$From]
$dst = $Sides[$To]
$changed = 0
$orphans = New-Object System.Collections.Generic.List[string]

$srcSkills = Get-SkillFiles $src.Skills
$dstSkills = Get-SkillFiles $dst.Skills
foreach ($rel in ($srcSkills.Keys | Sort-Object)) {
    $target = Join-Path $dst.Skills $rel
    if ((Test-Path $target) -and (Test-SameFile $srcSkills[$rel] $target)) { continue }
    $dir = Split-Path -Parent $target
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Copy-Item -LiteralPath $srcSkills[$rel] -Destination $target -Force
    Write-Host "  skill  $rel"
    $changed++
}
foreach ($rel in ($dstSkills.Keys | Where-Object { -not $srcSkills.ContainsKey($_) } | Sort-Object)) {
    $orphans.Add("skill  $rel")
}

$srcRules = Get-RuleFiles $src.Rules $From
$dstRules = Get-RuleFiles $dst.Rules $To
foreach ($name in ($srcRules.Keys | Sort-Object)) {
    $target = Get-RulePath $dst.Rules $name $To
    $text = Convert-Rule $srcRules[$name] $From $To
    if ((Test-Path $target) -and ([IO.File]::ReadAllText($target) -ceq $text)) { continue }
    Write-TextFile $target $text
    Write-Host "  rule   $name"
    $changed++
}
foreach ($name in ($dstRules.Keys | Where-Object { -not $srcRules.ContainsKey($_) } | Sort-Object)) {
    $orphans.Add("rule   $name")
}

if ($From -eq 'claude') {
    $srcSpeckit = Get-SpeckitSkills $src.Skills
    $dstSpeckit = Get-SpeckitSkills $dst.Skills
    foreach ($name in ($srcSpeckit.Keys | Sort-Object)) {
        $target = Join-Path $dst.Skills "$name/SKILL.md"
        $text = Convert-SpeckitSkill $srcSpeckit[$name]
        if (Test-SpeckitCopy $target $text) { continue }
        Write-TextFile $target $text
        Write-Host "  speckit $name"
        $changed++
    }
    foreach ($name in ($dstSpeckit.Keys | Where-Object { -not $srcSpeckit.ContainsKey($_) } | Sort-Object)) {
        $orphans.Add("speckit $name")
    }
}

Write-Host "Synced $From -> $To : $changed file(s) updated."
if ($orphans.Count -gt 0) {
    Write-Host "Only in $To (not deleted; remove by hand if obsolete):"
    $orphans | ForEach-Object { Write-Host "  $_" }
}
