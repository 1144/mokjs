@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe"  "%~dp0\node_modules\uglify-js\bin\uglifyjs" %*
) ELSE (
  node  "%~dp0\node_modules\uglify-js\bin\uglifyjs" %*
)
