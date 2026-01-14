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

RETRIES="${RETRIES:-3}"

DOWNLOADED_FILE=$(mktemp -d -t "tmp.install-flox-action-XXXXXXXX")/$(basename "$INPUT_DOWNLOAD_URL")
curl --user-agent "install-flox-action" \
    --retry "$RETRIES" \
    --retry-delay 5 \
    --retry-all-errors \
    "$INPUT_DOWNLOAD_URL" \
    --output "$DOWNLOADED_FILE";


echo "Installing flox..."

SUDO=''
if [ "$EUID" -ne 0 ]; then
  SUDO='sudo'
fi

INSTALL_RETRIES="$RETRIES"
RETRY_DELAY=5

install_package() {
  case $DOWNLOADED_FILE in
    *.rpm)
      $SUDO rpm -i --notriggers "$DOWNLOADED_FILE"
      ;;
    *.deb)
      $SUDO dpkg -i --no-triggers "$DOWNLOADED_FILE"
      ;;
    *.pkg)
      $SUDO installer -pkg "$DOWNLOADED_FILE" -target /
      ;;
    *)
      echo >&2 "Aborting: Unknown file '$DOWNLOADED_FILE' downloaded. Not sure how to install it."
      exit 1
      ;;
  esac
}

for attempt in $(seq 1 "$INSTALL_RETRIES"); do
  echo "Installation attempt $attempt of $INSTALL_RETRIES..."
  if install_package; then
    echo "Installation succeeded on attempt $attempt"
    break
  else
    if [ "$attempt" -eq "$INSTALL_RETRIES" ]; then
      echo >&2 "Installation failed after $INSTALL_RETRIES attempts"
      exit 1
    fi
    echo "Installation failed, retrying in ${RETRY_DELAY}s..."
    sleep "$RETRY_DELAY"
  fi
done

# Remove downloaded file
rm "$DOWNLOADED_FILE"

if [[ true == "$DISABLE_METRICS" ]]; then
  echo "Disabling metrics..."
  flox config --set disable_metrics true
fi
