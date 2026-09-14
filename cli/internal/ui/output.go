package ui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/mattn/go-isatty"
)

// PrintJSON writes a Convex value to stdout with no styling, indented but valid
// JSON. Scripts and agents depend on this being the only thing --json prints.
func PrintJSON(raw json.RawMessage) error {
	if len(raw) == 0 {
		raw = json.RawMessage("null")
	}
	var buf bytes.Buffer
	if err := json.Indent(&buf, raw, "", "  "); err != nil {
		_, err := fmt.Fprintln(os.Stdout, string(raw))
		return err
	}
	_, err := fmt.Fprintln(os.Stdout, buf.String())
	return err
}

// IsTTY reports whether stdin is a terminal. Nothing interactive may run when
// it is not. A file mode check is not enough: the null device is a character
// device too, so `hillpost submit < /dev/null` would otherwise open a form.
func IsTTY() bool {
	fd := os.Stdin.Fd()
	return isatty.IsTerminal(fd) || isatty.IsCygwinTerminal(fd)
}

// Field prints an aligned "label  value" line.
func Field(label, value string) {
	fmt.Println(Label.Render(label) + "  " + Value.Render(value))
}

// Date formats a Convex timestamp (milliseconds since the epoch) as a date. It
// is generic so it takes both a plain int64 and an api.Num.
func Date[T ~int64](ms T) string {
	if ms == 0 {
		return "-"
	}
	return time.UnixMilli(int64(ms)).Local().Format("2006-01-02")
}
