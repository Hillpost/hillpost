package api

import "strings"

// Error is an error returned by a Convex function. Its message is written by
// the backend and is shown to the user verbatim.
type Error struct {
	Message string
}

func (e *Error) Error() string { return e.Message }

// cleanErrorMessage strips the Convex wrapping from a thrown error so the user
// reads only what the backend meant to say: the request-id banner, the
// "Uncaught Error:" prefix and the stack trace all go.
func cleanErrorMessage(raw string) string {
	var kept []string
	for _, line := range strings.Split(strings.TrimSpace(raw), "\n") {
		trimmed := strings.TrimSpace(line)
		switch {
		case trimmed == "":
			continue
		case strings.HasPrefix(line, "    at "):
			continue
		case strings.HasPrefix(trimmed, "[Request ID:") && strings.HasSuffix(trimmed, "Server Error"):
			continue
		}
		kept = append(kept, trimmed)
	}
	if len(kept) == 0 {
		return strings.TrimSpace(raw)
	}
	for _, prefix := range []string{"Uncaught ConvexError: ", "Uncaught Error: "} {
		kept[0] = strings.TrimPrefix(kept[0], prefix)
	}
	return strings.TrimSpace(strings.Join(kept, "\n"))
}
