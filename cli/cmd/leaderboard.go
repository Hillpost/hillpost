package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/flow"
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
			board, err := flow.LoadLeaderboard(ctx, c, hackathonID)
			if err != nil {
				return "", err
			}
			return flow.LeaderboardView(board), nil
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
