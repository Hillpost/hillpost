package cmd

import (
	"reflect"
	"testing"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

func TestFormatScore(t *testing.T) {
	tests := []struct {
		in   float64
		want string
	}{
		{0, "0"},
		{7, "7"},
		{7.5, "7.5"},
		{7.44, "7.4"},
		{7.46, "7.5"},
		{12.333333, "12.3"},
	}
	for _, tt := range tests {
		if got := formatScore(tt.in); got != tt.want {
			t.Errorf("formatScore(%v) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestFormatOutOf(t *testing.T) {
	if got := formatOutOf(7.5, 20); got != "7.5 / 20" {
		t.Errorf("formatOutOf(7.5, 20) = %q", got)
	}
	if got := formatOutOf(3, 0); got != "3" {
		t.Errorf("formatOutOf(3, 0) = %q, want the bare score when no maximum is set", got)
	}
}

func TestLeaderboardRows(t *testing.T) {
	board := api.Leaderboard{
		MaxPossibleScore: 20,
		Entries: []api.LeaderboardEntry{
			{Rank: 1, TeamName: "Otters", OverallScore: 17.5, TotalJudgeCount: 2,
				LatestSubmission: &api.Submission{Name: "Riverbed"}},
			{Rank: 2, TeamName: "Herons", OverallScore: 0, TotalJudgeCount: 0},
		},
	}
	want := [][]string{
		{"1", "Otters", "Riverbed", "17.5 / 20", "2"},
		{"2", "Herons", "-", "0 / 20", "0"},
	}
	if got := leaderboardRows(board); !reflect.DeepEqual(got, want) {
		t.Errorf("leaderboardRows() = %v, want %v", got, want)
	}
}

func TestSubmissionRowsNamesTeams(t *testing.T) {
	submissions := []api.Submission{
		{ID: "s1", TeamID: "t1", Name: "Riverbed", SubmissionCount: 3, SubmittedAt: 1757808000000},
		{ID: "s2", TeamID: "gone", Name: "Nest", SubmissionCount: 1},
	}
	rows := submissionRows(submissions, teamNames([]api.Team{{ID: "t1", Name: "Otters"}}))
	if rows[0][0] != "Otters" {
		t.Errorf("known team should show its name, got %q", rows[0][0])
	}
	if rows[1][0] != "gone" {
		t.Errorf("unknown team should fall back to its id, got %q", rows[1][0])
	}
	if rows[0][2] != "3" {
		t.Errorf("submission count should be shown, got %q", rows[0][2])
	}
}

func TestTeamRowsCountMembers(t *testing.T) {
	rows := teamRows([]api.Team{{ID: "t1", Name: "Otters", Members: []api.Member{{}, {}}}})
	want := [][]string{{"Otters", "2", "t1"}}
	if !reflect.DeepEqual(rows, want) {
		t.Errorf("teamRows() = %v, want %v", rows, want)
	}
	if memberCount(1) != "1 member" || memberCount(0) != "0 members" {
		t.Errorf("memberCount pluralises wrongly: %q, %q", memberCount(1), memberCount(0))
	}
}

func TestMissingSubmitFlags(t *testing.T) {
	got := missingSubmitFlags(project{name: "Riverbed", projectURL: "  "})
	want := []string{"--description", "--url"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("missingSubmitFlags() = %v, want %v", got, want)
	}
	if got := missingSubmitFlags(project{name: "a", description: "b", projectURL: "c"}); got != nil {
		t.Errorf("a complete project should be missing nothing, got %v", got)
	}
}

func TestPrefillKeepsFlagsAndFillsGaps(t *testing.T) {
	latest := &api.Submission{
		Name:        "Riverbed",
		Description: "an old description",
		ProjectURL:  "https://github.com/otters/riverbed",
		DemoURL:     "https://youtu.be/old",
	}
	got := prefill(project{description: "a new description"}, latest)
	if got.description != "a new description" {
		t.Errorf("a flag must win over the last submission, got %q", got.description)
	}
	if got.name != "Riverbed" || got.demoURL != "https://youtu.be/old" {
		t.Errorf("empty fields should come from the last submission, got %+v", got)
	}
	if prefill(project{name: "x"}, nil).name != "x" {
		t.Error("a first submission has nothing to prefill from")
	}
}

func TestOptionalSubmitArgsSkipsBlanks(t *testing.T) {
	args := optionalSubmitArgs(project{demoURL: " https://youtu.be/x ", deployedURL: "   "})
	if args["demoUrl"] != "https://youtu.be/x" {
		t.Errorf("demoUrl should be trimmed and sent, got %v", args["demoUrl"])
	}
	if _, ok := args["deployedUrl"]; ok {
		t.Error("a blank optional field must not be sent")
	}
	if _, ok := args["whatsNew"]; ok {
		t.Error("an unset optional field must not be sent")
	}
}
