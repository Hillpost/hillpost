package api

import (
	"fmt"
	"strconv"
	"strings"
)

// Types used by the judge commands. Field names follow the Convex documents in
// convex/schema.ts exactly. Scores may be fractional, so they are float64;
// counts and timestamps are Num.

// Category is one scoring category, from categories:list. Scores run from 1 to
// MaxScore inclusive.
type Category struct {
	ID          string  `json:"_id"`
	HackathonID string  `json:"hackathonId"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	MaxScore    float64 `json:"maxScore"`
	Order       float64 `json:"order"`
}

// Score is one judge's score for one category, from scores:getMyScoresForSubmission.
type Score struct {
	ID              string  `json:"_id"`
	SubmissionID    string  `json:"submissionId"`
	CategoryID      string  `json:"categoryId"`
	JudgeID         string  `json:"judgeId"`
	Score           float64 `json:"score"`
	Feedback        string  `json:"feedback"`
	ScoredAt        Num     `json:"scoredAt"`
	SubmissionCount Num     `json:"submissionCount"`
}

// ScoreEntry is one category's average across every judge who scored it.
type ScoreEntry struct {
	CategoryID   string  `json:"categoryId"`
	AverageScore float64 `json:"averageScore"`
	JudgeCount   Num     `json:"judgeCount"`
}

// ScoreSummary is the return value of scores:getForSubmission. ScoresHidden is
// true when the hackathon's visibility settings keep the caller out.
type ScoreSummary struct {
	ScoresHidden bool         `json:"scoresHidden"`
	Entries      []ScoreEntry `json:"entries"`
}

// ValidateScore mirrors the range check in convex/scores.ts: a score runs from 1
// to the category's maxScore inclusive. Checking here saves a round trip, and the
// wording matches what the backend would have said.
func ValidateScore(score, maxScore float64) error {
	if score < 1 || score > maxScore {
		return fmt.Errorf("Score must be between 1 and %s", strconv.FormatFloat(maxScore, 'f', -1, 64))
	}
	return nil
}

// MatchCategory finds the category a user named: either its id, or its name
// ignoring case and surrounding space. Anything else is an error naming the
// categories that do exist.
func MatchCategory(categories []Category, query string) (Category, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return Category{}, fmt.Errorf("no category given")
	}
	for _, c := range categories {
		if c.ID == query {
			return c, nil
		}
	}

	var matches []Category
	for _, c := range categories {
		if strings.EqualFold(strings.TrimSpace(c.Name), query) {
			matches = append(matches, c)
		}
	}
	switch len(matches) {
	case 1:
		return matches[0], nil
	case 0:
		return Category{}, fmt.Errorf("no category %q in this hackathon (have: %s)", query, categoryNames(categories))
	default:
		return Category{}, fmt.Errorf("%q matches more than one category, pass its id instead", query)
	}
}

func categoryNames(categories []Category) string {
	if len(categories) == 0 {
		return "none"
	}
	names := make([]string, len(categories))
	for i, c := range categories {
		names[i] = c.Name
	}
	return strings.Join(names, ", ")
}
