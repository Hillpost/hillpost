package api

import "testing"

func TestCleanErrorMessage(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "plain message is untouched",
			raw:  "You are not on a team",
			want: "You are not on a team",
		},
		{
			name: "request id banner and stack are dropped",
			raw: "[Request ID: 5f4c0e1a2b3c] Server Error\n" +
				"Uncaught Error: Only competitors can create teams\n" +
				"    at handler (../convex/teams.ts:24:13)\n" +
				"    at async invokeMutation (../convex/_deps/x.js:12:3)",
			want: "Only competitors can create teams",
		},
		{
			name: "convex errors lose their prefix too",
			raw:  "Uncaught ConvexError: Rate limited. Please wait 3 more minute(s) before submitting again.",
			want: "Rate limited. Please wait 3 more minute(s) before submitting again.",
		},
		{
			name: "a multi-line message keeps its later lines",
			raw:  "Uncaught Error: Submissions are closed\nThey ended on 2026-09-01",
			want: "Submissions are closed\nThey ended on 2026-09-01",
		},
		{
			name: "a message that is only wrapping survives as itself",
			raw:  "[Request ID: abc] Server Error",
			want: "[Request ID: abc] Server Error",
		},
		{
			name: "empty stays empty",
			raw:  "",
			want: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cleanErrorMessage(tt.raw); got != tt.want {
				t.Errorf("cleanErrorMessage() = %q, want %q", got, tt.want)
			}
		})
	}
}
