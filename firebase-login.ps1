# Opens browser for Firebase login (PATH fix included)
$env:Path = "C:\Program Files\nodejs;$env:APPDATA\npm;" + $env:Path
& "$env:APPDATA\npm\firebase.cmd" login
