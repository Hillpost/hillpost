package api

import (
	"encoding/json"
	"testing"
)

func TestNumAcceptsConvexFloats(t *testing.T) {
	// Convex's JSON format spells every number as a double, so a submission
	// count arrives as 3.0 and a timestamp as 1789428054315.0.
	var s Submission
	if err := json.Unmarshal([]byte(`{"submissionCount":3.0,"submittedAt":1789428054315.0}`), &s); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if s.SubmissionCount != 3 {
		t.Errorf("submissionCount = %d, want 3", s.SubmissionCount)
	}
	if s.SubmittedAt != 1789428054315 {
		t.Errorf("submittedAt = %d, want 1789428054315", s.SubmittedAt)
	}

	var h Hackathon
	if err := json.Unmarshal([]byte(`{"startDate":1,"submissionsEndDate":2.0}`), &h); err != nil {
		t.Fatalf("Unmarshal: %v", err)
	}
	if h.StartDate != 1 {
		t.Errorf("a plain integer must still decode, got %d", h.StartDate)
	}
	if h.SubmissionsEndDate == nil || *h.SubmissionsEndDate != 2 {
		t.Errorf("optional numbers must decode too, got %v", h.SubmissionsEndDate)
	}
}
