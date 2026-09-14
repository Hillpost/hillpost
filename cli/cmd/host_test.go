package cmd

import (
	"testing"
	"time"
)

func TestParseDate(t *testing.T) {
	local := func(y int, m time.Month, d, hh, mm, ss int) int64 {
		return time.Date(y, m, d, hh, mm, ss, 0, time.Local).UnixMilli()
	}
	zone := func(offsetHours int) *time.Location {
		return time.FixedZone("", offsetHours*3600)
	}

	cases := []struct {
		in   string
		want int64
	}{
		{"2026-10-03", local(2026, time.October, 3, 0, 0, 0)},
		{"2026-10-03T09:00", local(2026, time.October, 3, 9, 0, 0)},
		{"2026-10-03T09:00:30", local(2026, time.October, 3, 9, 0, 30)},
		{"  2026-10-03T09:00  ", local(2026, time.October, 3, 9, 0, 0)},
		{"2026-10-03T09:00:00Z", time.Date(2026, time.October, 3, 9, 0, 0, 0, time.UTC).UnixMilli()},
		{"2026-10-03T09:00:00+02:00", time.Date(2026, time.October, 3, 9, 0, 0, 0, zone(2)).UnixMilli()},
	}
	for _, c := range cases {
		got, err := parseDate(c.in)
		if err != nil {
			t.Errorf("parseDate(%q): %v", c.in, err)
			continue
		}
		if got != c.want {
			t.Errorf("parseDate(%q) = %d, want %d", c.in, got, c.want)
		}
	}

	for _, bad := range []string{"", "   ", "tomorrow", "03/10/2026", "2026-13-03", "2026-10-03 09:00"} {
		if _, err := parseDate(bad); err == nil {
			t.Errorf("parseDate(%q) should have failed", bad)
		}
	}
}

func TestCreateArgs(t *testing.T) {
	saved := createFlags
	t.Cleanup(func() { createFlags = saved })

	createFlags.name = " Hillpost Jam "
	createFlags.start = "2026-10-03"
	createFlags.end = "2026-10-05"
	createFlags.frequency = 15

	args, err := createArgs()
	if err != nil {
		t.Fatalf("createArgs: %v", err)
	}
	if args["name"] != "Hillpost Jam" {
		t.Errorf("name = %v, want the trimmed name", args["name"])
	}
	if args["submissionFrequencyMinutes"] != 15 {
		t.Errorf("submissionFrequencyMinutes = %v, want 15", args["submissionFrequencyMinutes"])
	}
	if _, ok := args["submissionsStartDate"]; ok {
		t.Error("submissionsStartDate should be omitted when the flag is empty")
	}
	if args["startDate"].(int64) >= args["endDate"].(int64) {
		t.Error("startDate should be before endDate")
	}

	createFlags.submissionsEnd = "2026-10-05T17:00"
	args, err = createArgs()
	if err != nil {
		t.Fatalf("createArgs with submissions end: %v", err)
	}
	if _, ok := args["submissionsEndDate"]; !ok {
		t.Error("submissionsEndDate should be sent when the flag is set")
	}

	createFlags.name = ""
	if _, err := createArgs(); err == nil {
		t.Error("createArgs without a name should fail")
	}
}

func TestJoinLink(t *testing.T) {
	if got := joinLink("AbC123"); got != "https://hillpost.dev/join/AbC123" {
		t.Errorf("joinLink = %q", got)
	}
	if got := joinLink(""); got != "" {
		t.Errorf("joinLink(%q) = %q, want empty", "", got)
	}
}
