#!/bin/bash
cd "/Users/aum/Desktop/project/Aamako-Agro-Frontend"
node server.js &
echo "Server PID: $!"
sleep 1
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8080/index.html
echo ""
echo "Site ready at http://localhost:8080"
