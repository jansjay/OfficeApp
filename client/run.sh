#!/bin/bash

#################################################
# A script to run the Office App SPA when developing locally
#################################################

cd "$(dirname "${BASH_SOURCE[0]}")"
WEB_ORIGIN='https://web.officeapp-dev.com'

#
# Get the platform
#
case "$(uname -s)" in

  Darwin)
    PLATFORM="MACOS"
 	;;

  MINGW64*)
    PLATFORM="WINDOWS"
	;;

  Linux)
    PLATFORM="LINUX"
	;;
esac

#
# Ensure that the webhost is pointing to the correct API
#
cp deployment/environments/dev/spa.config.json spa/dist/spa.config.json
cp deployment/environments/dev/webhost.config.json webhost/webhost.config.json

#
# Run the web host to serve static content
# On Linux first ensure that you have first granted Node.js permissions to listen on port 443:
# - sudo setcap 'cap_net_bind_service=+ep' $(which node)
#
#
if [ "$PLATFORM" == 'MACOS' ]; then

  open -a Terminal ./webhost/run.sh

elif [ "$PLATFORM" == 'WINDOWS' ]; then
  
  GIT_BASH="C:\Program Files\Git\git-bash.exe"
  "$GIT_BASH" -c ./webhost/run.sh &

elif [ "$PLATFORM" == 'LINUX' ]; then

  gnome-terminal -- ./webhost/run.sh
fi

#
# Wait for it to become available
#
echo 'Waiting for Web Host to become available ...'
while [ "$(curl -k -s -o /dev/null -w ''%{http_code}'' "$WEB_ORIGIN/spa/index.html")" != '200' ]; do
  sleep 2
done

#
# Run the Office App SPA in the default browser, then sign in with these credentials:
# - guestuser@mycompany.com
# - Password1
#
if [ "$PLATFORM" == 'MACOS' ]; then

  open "$WEB_ORIGIN/spa"

elif [ "$PLATFORM" == 'WINDOWS' ]; then

  start "$WEB_ORIGIN/spa"

elif [ "$PLATFORM" == 'LINUX' ]; then

  xdg-open "$WEB_ORIGIN/spa"

fi
