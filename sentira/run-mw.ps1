$env:RUVIEW_NODE_PREFIX='wifi_densepose'
$env:MQTT_HOST='127.0.0.1'
$env:MQTT_PORT=1883
$env:MIDDLEWARE_PORT=4400
Set-Location 'C:\Users\Subhankar Roy\Desktop\sentira\sentira'
pnpm --filter @sentira/middleware start 2>&1 | Out-File -Append mw-output.log
