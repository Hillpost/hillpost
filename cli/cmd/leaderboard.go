package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/tui"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// watchInterval is how often --watch re-fetches the leaderboard.
const watchInterval = 5 * time.Second

var watchLeaderboard bool

var leaderboardCmd = &cobra.Command{
	Use:   "leaderboard",
	Short: "Show the current hackathon's ranked teams",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()
		hackathonID, err := resolveHackathon(ctx, c, cfg)
		if err != nil {
			return err
		}

		if jsonOut {
			var raw json.RawMessage
			if err := c.Query(ctx, "leaderboard:get", map[string]any{"hackathonId": hackathonID}, &raw); err != nil {
				return err
			}
			return ui.PrintJSON(raw)
		}

		render := func() (string, error) {
			var board api.Leaderboard
			if err := c.Query(ctx, "leaderboard:get", map[string]any{"hackathonId": hackathonID}, &board); err != nil {
				return "", err
			}
			return leaderboardView(board), nil
		}

		if watchLeaderboard {
			if !ui.IsTTY() {
				return errors.New("hillpost leaderboard --watch needs a terminal")
			}
			return tui.Watch(watchInterval, render)
		}

		view, err := render()
		if err != nil {
			return err
		}
		fmt.Print(view)
		return nil
	},
}

func init() {
	leaderboardCmd.Flags().BoolVar(&watchLeaderboard, "watch", false, "redraw every five seconds until you press q")
	rootCmd.AddCommand(leaderboardCmd)
}

// leaderboardView renders the whole leaderboard, including its empty states.
func leaderboardView(board api.Leaderboard) string {
	if board.LeaderboardHidden {
		return ui.Label.Render("The organizer has hidden the leaderboard.") + "\n"
	}
	if len(board.Entries) == 0 {
		return ui.Label.Render("No teams on the leaderboard yet.") + "\n"
	}
	return ui.Table([]string{"#", "TEAM", "PROJECT", "SCORE", "JUDGES"}, leaderboardRows(board))
}

// leaderboardRows renders one row per ranked team. A team that has not
// submitted shows a dash instead of a project.
func leaderboardRows(board api.Leaderboard) [][]string {
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
			formatOutOf(e.OverallScore, board.MaxPossibleScore),
			strconv.Itoa(e.TotalJudgeCount.Int()),
		})
	}
	return rows
}

// formatOutOf renders a score as "7.5 / 20", or just the score when no maximum
// is configured.
func formatOutOf(score, max float64) string {
	if max <= 0 {
		return formatScore(score)
	}
	return formatScore(score) + " / " + formatScore(max)
}

// formatScore prints a score with at most one decimal, so whole numbers stay
// whole.
func formatScore(v float64) string {
	s := strconv.FormatFloat(v, 'f', 1, 64)
	return strings.TrimSuffix(s, ".0")
}
