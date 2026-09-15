package api

import "testing"

func TestValidateScore(t *testing.T) {
	cases := []struct {
		score, max float64
		wantErr    string
	}{
		{1, 10, ""},
		{10, 10, ""},
		{7.5, 10, ""},
		{0, 10, "Score must be between 1 and 10"},
		{11, 10, "Score must be between 1 and 10"},
		{-1, 5, "Score must be between 1 and 5"},
		{3, 2.5, "Score must be between 1 and 2.5"},
	}
	for _, c := range cases {
		err := ValidateScore(c.score, c.max)
		switch {
		case c.wantErr == "" && err != nil:
			t.Errorf("ValidateScore(%v, %v) = %v, want nil", c.score, c.max, err)
		case c.wantErr != "" && err == nil:
			t.Errorf("ValidateScore(%v, %v) = nil, want %q", c.score, c.max, c.wantErr)
		case c.wantErr != "" && err.Error() != c.wantErr:
			t.Errorf("ValidateScore(%v, %v) = %q, want %q", c.score, c.max, err, c.wantErr)
		}
	}
}

func TestMatchCategory(t *testing.T) {
	categories := []Category{
		{ID: "cat_creativity", Name: "Creativity", MaxScore: 10},
		{ID: "cat_execution", Name: " Execution ", MaxScore: 5},
	}

	for _, query := range []string{"cat_execution", "Execution", "execution", "  EXECUTION  "} {
		got, err := MatchCategory(categories, query)
		if err != nil {
			t.Fatalf("MatchCategory(%q) failed: %v", query, err)
		}
		if got.ID != "cat_execution" {
			t.Errorf("MatchCategory(%q) = %q, want cat_execution", query, got.ID)
		}
	}

	if _, err := MatchCategory(categories, ""); err == nil {
		t.Error("MatchCategory with an empty query should fail")
	}
	_, err := MatchCategory(categories, "Design")
	if err == nil {
		t.Fatal("MatchCategory with an unknown name should fail")
	}
	want := `no category "Design" in this hackathon (have: Creativity,  Execution )`
	if err.Error() != want {
		t.Errorf("got %q, want %q", err, want)
	}

	dupes := []Category{{ID: "a", Name: "Impact"}, {ID: "b", Name: "impact"}}
	if _, err := MatchCategory(dupes, "impact"); err == nil {
		t.Error("an ambiguous name should fail, not pick one")
	}
	if got, err := MatchCategory(dupes, "b"); err != nil || got.ID != "b" {
		t.Errorf("an id should still win over an ambiguous name: %v %v", got, err)
	}
}
