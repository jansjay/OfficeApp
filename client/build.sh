#!/bin/bash

#######################################################
# A script to build the SPA resources ready for running
#######################################################

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
# Build the development web host's code
#
cd webhost
./build.sh
if [ $? -ne 0 ]; then
  echo 'Problem encountered building the development web host'
  exit
fi

#
# Build the SPA's code
#
cd ../spa
./build.sh
if [ $? -ne 0 ]; then
  echo 'Problem encountered building the SPA'
  exit
fi
cd ..
