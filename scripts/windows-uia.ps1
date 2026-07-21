param([Parameter(Mandatory=$true)][int]$WindowHandle)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$condition = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, $WindowHandle)
$root = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $condition)
if ($null -eq $root) { exit 0 }
$items = New-Object System.Collections.Generic.List[string]
$nodes = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
$maximum = [Math]::Min($nodes.Count, 240)
for ($index = 0; $index -lt $maximum; $index++) {
  $element = $nodes.Item($index)
  $name = $element.Current.Name
  if (![string]::IsNullOrWhiteSpace($name)) { $items.Add($name.Trim()) }
  $pattern = $null
  if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
    $value = ([System.Windows.Automation.ValuePattern]$pattern).Current.Value
    if (![string]::IsNullOrWhiteSpace($value)) { $items.Add($value.Trim()) }
  }
}
($items | Select-Object -Unique) -join "`n"
