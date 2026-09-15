#!/bin/sh
# Checks docs/cli/commands.md against the real command surface.
#
#   cli/scripts/check-docs.sh [path-to-hillpost-binary]
#
# Every command documented under a "### `hillpost ...`" heading must run with
# --help, and every long flag the section names must appear in that help output.
# Exits non-zero on the first mismatch it can report, after listing them all.
set -eu

root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
doc="$root/docs/cli/commands.md"
bin=${1:-${HILLPOST_BIN:-"$root/cli/hillpost"}}

[ -f "$doc" ] || { echo "check-docs: no $doc" >&2; exit 1; }
if ! command -v "$bin" >/dev/null 2>&1 && [ ! -x "$bin" ]; then
	if [ -x "$bin.exe" ]; then
		bin="$bin.exe"
	else
		echo "check-docs: no hillpost binary at $bin (build it: cd cli && go build -o hillpost ./cmd/hillpost)" >&2
		exit 1
	fi
fi

# Emit one "CMD<tab>name" line per documented command and one
# "FLAG<tab>name<tab>--flag" line per long flag named in its section.
claims=$(awk '
/^### / {
	line = $0
	cur = ""
	while (match(line, /`hillpost[^`]*`/)) {
		seg = substr(line, RSTART + 1, RLENGTH - 2)
		line = substr(line, RSTART + RLENGTH)
		gsub(/<[^>]*>/, "", seg)
		gsub(/\[[^]]*\]/, "", seg)
		gsub(/  +/, " ", seg)
		sub(/ +$/, "", seg)
		print "CMD\t" seg
		if (cur == "") cur = seg
	}
	fenced = 0
	next
}
cur == "" { next }
/^```/ { fenced = !fenced; next }
{
	line = $0
	if (fenced) {
		while (match(line, /--[a-z][a-z-]*/)) {
			print "FLAG\t" cur "\t" substr(line, RSTART, RLENGTH)
			line = substr(line, RSTART + RLENGTH)
		}
	} else {
		while (match(line, /`--[a-z][a-z-]*/)) {
			print "FLAG\t" cur "\t" substr(line, RSTART + 1, RLENGTH - 1)
			line = substr(line, RSTART + RLENGTH)
		}
	}
}
' "$doc" | sort -u)

[ -n "$claims" ] || { echo "check-docs: no commands found in $doc" >&2; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT INT TERM
failures=0
checked=0

help_for() {
	key=$(echo "$1" | tr ' /' '__')
	file="$tmp/$key"
	if [ ! -f "$file" ]; then
		# shellcheck disable=SC2086
		"$bin" ${1#hillpost } --help >"$file" 2>&1 || return 1
	fi
	cat "$file"
}

echo "$claims" >"$tmp/claims"

# Redirect rather than pipe: a piped while loop runs in a subshell and the
# counters would not survive it.
while IFS="$(printf '\t')" read -r kind name flag; do
	case $kind in
	CMD)
		checked=$((checked + 1))
		if help_for "$name" >/dev/null; then
			echo "ok    $name"
		else
			echo "FAIL  $name --help does not run" >&2
			failures=$((failures + 1))
		fi
		;;
	FLAG)
		checked=$((checked + 1))
		if help_for "$name" 2>/dev/null | grep -q -- "$flag"; then
			echo "ok    $name $flag"
		else
			echo "FAIL  $name has no $flag" >&2
			failures=$((failures + 1))
		fi
		;;
	esac
done <"$tmp/claims"

if [ "$failures" -gt 0 ]; then
	echo "check-docs: $failures problem(s) in $doc" >&2
	exit 1
fi
echo "check-docs: $checked claims in commands.md match $bin"
