@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\mok" %*
) ELSE (
  node "%~dp0\mok" %*
)
pause
