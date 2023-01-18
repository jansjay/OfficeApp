#!/bin/bash

###############################################
# A convenience script to start all the servers
###############################################

GIT_BASH="C:\Program Files\Git\git-bash.exe"

chmod +x ./openidprovider/start.sh
"$GIT_BASH" -c ./openidprovider/start.sh &

chmod +x ./tokenhandler/start.sh
"$GIT_BASH" -c ./tokenhandler/start.sh &

chmod +x ./api/start.sh
"$GIT_BASH" -c ./api/start.sh &

chmod +x ./client/build.sh
./client/build.sh

chmod +x ./client/run.sh
"$GIT_BASH" -c ./client/run.sh &
