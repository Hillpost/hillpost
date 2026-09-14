package api

import (
	"encoding/json"
	"testing"
)

func TestNumberDecodesConvexFloats(t *testing.T) {
	// Convex's JSON format writes every number with a decimal point.
	var h Hackathon
	body := `{"startDate":1789428323350.0,"submissionFrequencyMinutes":30.0,"submissionsEndDate":null}`
	if err := json.Unmarshal([]byte(body), &h); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if h.StartDate != 1789428323350 {
		t.Errorf("StartDate = %d", h.StartDate)
	}
	if h.SubmissionFrequencyMinutes != 30 {
		t.Errorf("SubmissionFrequencyMinutes = %d", h.SubmissionFrequencyMinutes)
	}
	if h.SubmissionsEndDate != nil {
		t.Errorf("SubmissionsEndDate = %v, want nil", h.SubmissionsEndDate)
	}

	out, err := json.Marshal(Number(30))
	if err != nil || string(out) != "30" {
		t.Errorf("Marshal(Number(30)) = %q, %v", out, err)
	}
}
