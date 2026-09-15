package flow

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
		if got := FormatScore(tt.in); got != tt.want {
			t.Errorf("FormatScore(%v) = %q, want %q", tt.in, got, tt.want)
		}
	}
}

func TestFormatOutOf(t *testing.T) {
	if got := FormatOutOf(7.5, 20); got != "7.5 / 20" {
		t.Errorf("FormatOutOf(7.5, 20) = %q", got)
	}
	if got := FormatOutOf(3, 0); got != "3" {
		t.Errorf("FormatOutOf(3, 0) = %q, want the bare score when no maximum is set", got)
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
	if got := LeaderboardRows(board); !reflect.DeepEqual(got, want) {
		t.Errorf("LeaderboardRows() = %v, want %v", got, want)
	}
}

func TestSubmissionRowsNamesTeams(t *testing.T) {
	submissions := []api.Submission{
		{ID: "s1", TeamID: "t1", Name: "Riverbed", SubmissionCount: 3, SubmittedAt: 1757808000000},
		{ID: "s2", TeamID: "gone", Name: "Nest", SubmissionCount: 1},
	}
	rows := SubmissionRows(submissions, TeamNames([]api.Team{{ID: "t1", Name: "Otters"}}))
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

func TestMissingNamesTheFlagsThatAreStillEmpty(t *testing.T) {
	got := Project{Name: "Riverbed", ProjectURL: "  "}.Missing()
	want := []string{"--description", "--url"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("Missing() = %v, want %v", got, want)
	}
	if got := (Project{Name: "a", Description: "b", ProjectURL: "c"}).Missing(); got != nil {
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
	got := Prefill(Project{Description: "a new description"}, latest)
	if got.Description != "a new description" {
		t.Errorf("a flag must win over the last submission, got %q", got.Description)
	}
	if got.Name != "Riverbed" || got.DemoURL != "https://youtu.be/old" {
		t.Errorf("empty fields should come from the last submission, got %+v", got)
	}
	if Prefill(Project{Name: "x"}, nil).Name != "x" {
		t.Error("a first submission has nothing to prefill from")
	}
}

func TestSubmitSkipsBlankOptionalFields(t *testing.T) {
	var sent map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var call struct {
			Path string         `json:"path"`
			Args map[string]any `json:"args"`
		}
		if err := json.NewDecoder(r.Body).Decode(&call); err != nil {
			t.Errorf("bad request body: %v", err)
		}
		value := any("sub_1")
		if call.Path == "submissions:create" {
			sent = call.Args
		} else {
			value = map[string]any{"_id": "sub_1", "name": "Riverbed", "submissionCount": 1}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"status": "success", "value": value})
	}))
	defer server.Close()

	_, _, err := Submit(t.Context(), api.New(server.URL, "hp_test"), "hack_1", "team_1", Project{
		Name:        "Riverbed",
		Description: "A dam fine project",
		ProjectURL:  "https://github.com/otters/riverbed",
		DemoURL:     " https://youtu.be/x ",
		DeployedURL: "   ",
	})
	if err != nil {
		t.Fatalf("Submit: %v", err)
	}
	if sent["demoUrl"] != "https://youtu.be/x" {
		t.Errorf("demoUrl should be trimmed and sent, got %v", sent["demoUrl"])
	}
	if _, ok := sent["deployedUrl"]; ok {
		t.Error("a blank optional field must not be sent")
	}
	if _, ok := sent["whatsNew"]; ok {
		t.Error("an unset optional field must not be sent")
	}
}

func TestSubmitRefusesAnIncompleteProject(t *testing.T) {
	_, _, err := Submit(t.Context(), api.New("http://127.0.0.1:1", ""), "hack_1", "team_1", Project{Name: "Riverbed"})
	if err != ErrIncomplete {
		t.Errorf("an incomplete project should not reach the backend, got %v", err)
	}
}
