package flow

import (
	"context"
	"strconv"
	"strings"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// The renderings both the commands and the dashboard show. They return a string
// rather than printing, so the dashboard can put them on a screen.

// LoadLeaderboard reads the hackathon's ranked teams.
func LoadLeaderboard(ctx context.Context, c *api.Client, hackathonID string) (api.Leaderboard, error) {
	var board api.Leaderboard
	err := c.Query(ctx, "leaderboard:get", map[string]any{"hackathonId": hackathonID}, &board)
	return board, err
}

// LeaderboardView renders the whole leaderboard, including its empty states.
func LeaderboardView(board api.Leaderboard) string {
	if board.LeaderboardHidden {
		return ui.Label.Render("The organizer has hidden the leaderboard.") + "\n"
	}
	if len(board.Entries) == 0 {
		return ui.Label.Render("No teams on the leaderboard yet.") + "\n"
	}
	return ui.Table([]string{"#", "TEAM", "PROJECT", "SCORE", "JUDGES"}, LeaderboardRows(board))
}

// LeaderboardRows renders one row per ranked team. A team that has not
// submitted shows a dash instead of a project.
func LeaderboardRows(board api.Leaderboard) [][]string {
	rows := make([][]string, 0, len(board.Entries))
	for _, e := range board.Entries {
		project := "-"
		if e.LatestSubmission != nil {
			project = e.LatestSubmission.Name
		}
		rows = append(rows, []string{
			strconv.Itoa(e.Rank.Int()),
			e.TeamName,
			project,
			FormatOutOf(e.OverallScore, board.MaxPossibleScore),
			strconv.Itoa(e.TotalJudgeCount.Int()),
		})
	}
	return rows
}

// FormatOutOf renders a score as "7.5 / 20", or just the score when no maximum
// is configured.
func FormatOutOf(score, max float64) string {
	if max <= 0 {
		return FormatScore(score)
	}
	return FormatScore(score) + " / " + FormatScore(max)
}

// FormatScore prints a score with at most one decimal, so whole numbers stay
// whole.
func FormatScore(v float64) string {
	return strings.TrimSuffix(strconv.FormatFloat(v, 'f', 1, 64), ".0")
}

// TeamNames maps team ids to names, so anything listed by team can be named.
func TeamNames(teams []api.Team) map[string]string {
	names := make(map[string]string, len(teams))
	for _, t := range teams {
		names[t.ID] = t.Name
	}
	return names
}

// SubmissionRows renders submissions as table rows. A team whose name is
// unknown is shown by id, which is still enough to look it up.
func SubmissionRows(submissions []api.Submission, names map[string]string) [][]string {
	rows := make([][]string, 0, len(submissions))
	for _, s := range submissions {
		team := names[s.TeamID]
		if team == "" {
			team = s.TeamID
		}
		rows = append(rows, []string{
			team,
			s.Name,
			strconv.Itoa(s.SubmissionCount.Int()),
			ui.Date(s.SubmittedAt),
			s.ID,
		})
	}
	return rows
}

// SubmissionsView renders the submission list, including its empty state.
func SubmissionsView(submissions []api.Submission, names map[string]string) string {
	if len(submissions) == 0 {
		return ui.Label.Render("No submissions yet.") + "\n"
	}
	return ui.Table([]string{"TEAM", "PROJECT", "N", "LAST", "ID"}, SubmissionRows(submissions, names))
}
