#!/bin/bash

###############################################
# A convenience script to start the open id provider
###############################################

#
# Set the current folder if this script is called from another script
#
cd "$(dirname "${BASH_SOURCE[0]}")"

#
# Generated certificates should be available in ../cert folder
# You need to ensure that the operating system trusts the file downloaded to ../certs/officeapp-dev.ca.pem
#
if [ ! -d '../certs' ]; then
  echo "Certificates does not exist"
  exit
fi

#
# Ignores SSL Issues
# TODO Only should be done in DEV
#
export NODE_TLS_REJECT_UNAUTHORIZED=0

#
# Install API dependencies
#
if [ ! -d 'node_modules' ]; then
  
  rm -rf node_modules
  npm install
  if [ $? -ne 0 ]; then
    echo 'Problem encountered installing the OAuth Agent dependencies'
    exit
  fi
fi

# Run
node src/app.js