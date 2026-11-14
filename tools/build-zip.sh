#!/bin/bash
# The plugin as WordPress.org and a site get it: dist/visionforgex/ and dist/visionforgex-<version>.zip.
# Builds the dashboard first (npm run build), then copies everything .distignore does not leave out.
#     bash tools/build-zip.sh
set -e
cd "$(dirname "$0")/.."
VERSION=$(grep -m1 "^ \* Version:" visionforgex.php | awk '{print $3}')
STABLE=$(grep -m1 "^Stable tag:" readme.txt | awk '{print $3}')
CONST=$(grep -m1 "VISIONFORGEX_VERSION'" visionforgex.php | grep -o "[0-9][0-9.]*")
[ "$VERSION" = "$STABLE" ] && [ "$VERSION" = "$CONST" ] || { echo "Version $VERSION, Stable tag $STABLE and VISIONFORGEX_VERSION $CONST must match"; exit 1; }
npm run build >/dev/null
rm -rf dist && mkdir -p dist/visionforgex
rsync -a --exclude-from=.distignore ./ dist/visionforgex/
( cd dist && zip -qr "visionforgex-$VERSION.zip" visionforgex )
echo "dist/visionforgex-$VERSION.zip ($(du -h "dist/visionforgex-$VERSION.zip" | cut -f1), $(find dist/visionforgex -type f | wc -l) files)"
