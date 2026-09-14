package ui

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"time"
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
// it is not.
func IsTTY() bool {
	info, err := os.Stdin.Stat()
	if err != nil {
		return false
	}
	return info.Mode()&os.ModeCharDevice != 0
}

// Field prints an aligned "label  value" line.
func Field(label, value string) {
	fmt.Println(Label.Render(label) + "  " + Value.Render(value))
}

// Date formats a Convex timestamp (milliseconds since the epoch) as a date.
func Date(ms int64) string {
	if ms == 0 {
		return "-"
	}
	return time.UnixMilli(ms).Local().Format("2006-01-02")
}
