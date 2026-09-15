#!/bin/sh
# Installs the hillpost CLI.
#
#   curl -fsSL https://hillpost.dev/install.sh | sh
#
# Set HILLPOST_INSTALL_DIR to choose where the binary lands. Otherwise it goes
# to /usr/local/bin when that is writable, else ~/.local/bin.
set -eu

REPO="Hillpost/hillpost"
API="https://api.github.com/repos/$REPO/releases"

die() {
	echo "install: $1" >&2
	exit 1
}

need() {
	command -v "$1" >/dev/null 2>&1 || die "$1 is required"
}

need curl
need tar

os=$(uname -s | tr '[:upper:]' '[:lower:]')
case "$os" in
darwin | linux) ;;
*) die "unsupported OS: $os (on Windows, download the zip from https://github.com/$REPO/releases)" ;;
esac

arch=$(uname -m)
case "$arch" in
x86_64 | amd64) arch=amd64 ;;
arm64 | aarch64) arch=arm64 ;;
*) die "unsupported architecture: $arch" ;;
esac

# The newest cli/v* tag. The releases list is newest first.
tag=$(curl -fsSL "$API?per_page=100" |
	grep -o '"tag_name": *"cli/v[^"]*"' |
	head -n 1 |
	sed 's/.*"\(cli\/v[^"]*\)"$/\1/')
[ -n "$tag" ] || die "no cli/v* release found at https://github.com/$REPO/releases"
version=${tag#cli/v}

archive="hillpost_${version}_${os}_${arch}.tar.gz"
base="https://github.com/$REPO/releases/download/$tag"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM

echo "Downloading hillpost $version ($os/$arch)"
curl -fsSL "$base/$archive" -o "$tmp/$archive" || die "no build for $os/$arch in $tag"
curl -fsSL "$base/checksums.txt" -o "$tmp/checksums.txt" || die "could not download checksums.txt"

expected=$(awk -v f="$archive" '$NF == f { print $1 }' "$tmp/checksums.txt")
[ -n "$expected" ] || die "$archive is not listed in checksums.txt"
if command -v sha256sum >/dev/null 2>&1; then
	actual=$(sha256sum "$tmp/$archive" | cut -d' ' -f1)
elif command -v shasum >/dev/null 2>&1; then
	actual=$(shasum -a 256 "$tmp/$archive" | cut -d' ' -f1)
else
	die "sha256sum or shasum is required"
fi
[ "$actual" = "$expected" ] || die "checksum mismatch for $archive"

tar -xzf "$tmp/$archive" -C "$tmp" hillpost

if [ -n "${HILLPOST_INSTALL_DIR:-}" ]; then
	dir=$HILLPOST_INSTALL_DIR
elif [ -w /usr/local/bin ]; then
	dir=/usr/local/bin
else
	dir=$HOME/.local/bin
fi
mkdir -p "$dir" || die "could not create $dir"
install -m 755 "$tmp/hillpost" "$dir/hillpost" || die "could not write to $dir"

echo "Installed hillpost $version to $dir/hillpost"
case ":$PATH:" in
*":$dir:"*) ;;
*) echo "Add it to your PATH:  export PATH=\"$dir:\$PATH\"" ;;
esac
echo "Next:  hillpost login"
