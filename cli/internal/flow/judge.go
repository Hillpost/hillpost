package flow

import (
	"context"
	"sort"
	"strings"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

// JudgeContext is everything the judging screen shows: the hackathon's
// submissions ordered by team, the team names they are ordered by, and the
// categories they are scored on.
type JudgeContext struct {
	Submissions []api.Submission
	TeamNames   map[string]string // team id -> team name
	Categories  []api.Category
}

// LoadJudgeContext fetches the three lists judging needs.
func LoadJudgeContext(ctx context.Context, c *api.Client, hackathonID string) (JudgeContext, error) {
	var out JudgeContext
	if err := c.Query(ctx, "submissions:list", map[string]any{"hackathonId": hackathonID}, &out.Submissions); err != nil {
		return JudgeContext{}, err
	}
	var teams []api.Team
	if err := c.Query(ctx, "teams:list", map[string]any{"hackathonId": hackathonID}, &teams); err != nil {
		return JudgeContext{}, err
	}
	if err := c.Query(ctx, "categories:list", map[string]any{"hackathonId": hackathonID}, &out.Categories); err != nil {
		return JudgeContext{}, err
	}

	out.TeamNames = TeamNames(teams)
	sort.SliceStable(out.Submissions, func(i, j int) bool {
		return strings.ToLower(out.TeamNames[out.Submissions[i].TeamID]) <
			strings.ToLower(out.TeamNames[out.Submissions[j].TeamID])
	})
	return out, nil
}

// ScoredBy reports whether this judge has already scored this iteration.
func ScoredBy(s api.Submission, userID string) bool {
	for _, id := range s.JudgedBy {
		if id == userID {
			return true
		}
	}
	return false
}
