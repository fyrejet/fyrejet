#!/bin/sh

# get current directory
current_dir="$(dirname "${0}")"

# generates certs for ssl test
mkdir "$current_dir/tmp/"
openssl req -x509 -newkey rsa:4096 -keyout "$current_dir/tmp/test.key" -out "$current_dir/tmp/test.crt" -days 1 -nodes -subj "/C=RU/ST=Moscow/L=Moscow/O=Fyrejet/CN=localhost" -passin 'pass:1234'

# declares variable that enables uWS tests
export UWS_SERVER_ENABLED_FOR_TEST="TRUE"

# run tests
mocha --require "$current_dir/support/env" --reporter spec --bail --check-leaks "$current_dir" "$current_dir/acceptance/" --exit

# clean up temporary cert
rm -rf "$current_dir/tmp/"