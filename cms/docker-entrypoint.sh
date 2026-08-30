#!/bin/sh
set -eu
# Named volumes for /opt/app/public/uploads are created as root. Strapi
# (and sharp) write as the node user and would otherwise EACCES-crash.
mkdir -p /opt/app/public/uploads
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /opt/app/public/uploads
  exec gosu node "$@"
fi
exec "$@"
