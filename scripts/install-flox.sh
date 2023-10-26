#!/usr/bin/env bash
set -euo pipefail

# Ensure curl is available
command -v curl >/dev/null 2>&1 || {
  echo >&2 "Aborting: 'curl' is not installed.";
  exit 1;
}


if [ -z "$INSTALLER_FILE" ]; then

  # Ensure INPUT_DOWNLOAD_URL is set
  if [ -z "$INPUT_DOWNLOAD_URL" ]; then
    echo >&2 "Aborting: 'INPUT_DOWNLOAD_URL' environment variable is not set.";
    exit 1;
  fi

  echo "Downloading flox..."
  INSTALLER_FILE=$(basename $INPUT_DOWNLOAD_URL)
  curl "$INPUT_DOWNLOAD_URL" --output "$INSTALLER_FILE";
fi


echo "Installing flox..."

SUDO=''
if [ "$EUID" -ne 0 ]; then
  SUDO='sudo'
fi

case $INSTALLER_FILE in
  *.rpm)
    $SUDO rpm -i "$INSTALLER_FILE";
    ;;
  *.deb)
    $SUDO dpkg -i "$INSTALLER_FILE";
    ;;
  *.pkg)
    $SUDO installer -pkg "$INSTALLER_FILE" -target /;
    ;;
  *)
    echo >&2 "Aborting: Unknown file '$INSTALLER_FILE' downloaded. Not sure how to install it.";
    exit 1;
    ;;
esac
