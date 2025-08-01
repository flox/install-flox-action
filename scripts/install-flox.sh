#!/usr/bin/env bash
set -euo pipefail

# Ensure curl is available
command -v curl >/dev/null 2>&1 || {
  echo >&2 "Aborting: 'curl' is not installed.";
  exit 1;
}

# Ensure INPUT_DOWNLOAD_URL is set
if [ -z "$INPUT_DOWNLOAD_URL" ]; then
  echo >&2 "Aborting: 'INPUT_DOWNLOAD_URL' environment variable is not set.";
  exit 1;
fi


echo "Downloading flox..."

DOWNLOADED_FILE=$(mktemp -d -t "tmp.install-flox-action-XXXXXXXX")/$(basename "$INPUT_DOWNLOAD_URL")
curl --user-agent "install-flox-action" \
    "$INPUT_DOWNLOAD_URL" \
    --output "$DOWNLOADED_FILE";


echo "Installing flox..."

SUDO=''
if [ "$EUID" -ne 0 ]; then
  SUDO='sudo'
fi

case $DOWNLOADED_FILE in
  *.rpm)
    $SUDO rpm -i "$DOWNLOADED_FILE";
    ;;
  *.deb)
    $SUDO dpkg -i "$DOWNLOADED_FILE";
    ;;
  *.pkg)
    $SUDO installer -pkg "$DOWNLOADED_FILE" -target /;
    ;;
  *)
    echo >&2 "Aborting: Unknown file '$DOWNLOADED_FILE' downloaded. Not sure how to install it.";
    exit 1;
    ;;
esac

# Remove downloaded file
rm "$DOWNLOADED_FILE"

if [[ true == "$DISABLE_METRICS" ]]; then
  echo "Disabling metrics..."
  flox config --set-bool disable_metrics true
fi
