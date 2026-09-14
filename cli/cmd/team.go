package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/tui"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var teamCmd = &cobra.Command{
	Use:   "team",
	Short: "Create, join and inspect your team",
}

var teamListCmd = &cobra.Command{
	Use:   "list",
	Short: "List every team in the current hackathon",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
		if err != nil {
			return err
		}

		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "teams:list", map[string]any{"hackathonId": hackathonID}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}

		var teams []api.Team
		if err := json.Unmarshal(raw, &teams); err != nil {
			return err
		}
		if len(teams) == 0 {
			fmt.Println(ui.Label.Render("No teams yet. Run: hillpost team create <name>"))
			return nil
		}
		fmt.Print(ui.Table([]string{"NAME", "MEMBERS", "ID"}, teamRows(teams)))
		return nil
	},
}

var teamShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show the team you are on",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
		if err != nil {
			return err
		}

		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "teams:getMyTeam", map[string]any{"hackathonId": hackathonID}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}

		var team *api.Team
		if err := json.Unmarshal(raw, &team); err != nil {
			return err
		}
		if team == nil {
			fmt.Println(ui.Label.Render("You are not on a team. Run: hillpost team create <name>"))
			return nil
		}
		fmt.Println(ui.Title.Render(team.Name))
		ui.Field("team id", team.ID)
		if len(team.Members) == 0 {
			return nil
		}
		rows := make([][]string, 0, len(team.Members))
		for _, m := range team.Members {
			rows = append(rows, []string{m.UserName, m.Role, m.Status})
		}
		fmt.Println()
		fmt.Print(ui.Table([]string{"MEMBER", "ROLE", "STATUS"}, rows))
		return nil
	},
}

var teamCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create a team and join it",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := strings.TrimSpace(args[0])
		if name == "" {
			return errors.New("a team needs a name")
		}
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
		if err != nil {
			return err
		}

		var raw json.RawMessage
		if err := c.Mutate(cmd.Context(), "teams:create", map[string]any{
			"hackathonId": hackathonID,
			"name":        name,
		}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		var teamID string
		if err := json.Unmarshal(raw, &teamID); err != nil {
			return err
		}
		fmt.Println(ui.Success.Render("Created " + name))
		ui.Field("team id", teamID)
		return nil
	},
}

var teamJoinCmd = &cobra.Command{
	Use:   "join [teamId]",
	Short: "Join a team in the current hackathon",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
		if err != nil {
			return err
		}

		teamID, teamName := "", ""
		if len(args) == 1 {
			// Look the team up first so the confirmation can name it.
			teamID = strings.TrimSpace(args[0])
			var team *api.Team
			if err := c.Query(cmd.Context(), "teams:get", map[string]any{"teamId": teamID}, &team); err != nil {
				return err
			}
			if team == nil {
				return fmt.Errorf("no team found for %q", teamID)
			}
			teamName = team.Name
		} else {
			teamID, teamName, err = pickTeam(cmd.Context(), c, hackathonID)
			if err != nil {
				return err
			}
		}

		var raw json.RawMessage
		if err := c.Mutate(cmd.Context(), "teams:joinTeam", map[string]any{"teamId": teamID}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Joined " + teamName))
		return nil
	},
}

var teamLeaveCmd = &cobra.Command{
	Use:   "leave",
	Short: "Leave your team in the current hackathon",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
		if err != nil {
			return err
		}

		var raw json.RawMessage
		if err := c.Mutate(cmd.Context(), "teams:leaveTeam", map[string]any{"hackathonId": hackathonID}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Left your team."))
		return nil
	},
}

func init() {
	teamCmd.AddCommand(teamListCmd, teamShowCmd, teamCreateCmd, teamJoinCmd, teamLeaveCmd)
	rootCmd.AddCommand(teamCmd)
}

// pickTeam asks the user to choose one of the hackathon's teams.
func pickTeam(ctx context.Context, c *api.Client, hackathonID string) (id, name string, err error) {
	if !ui.IsTTY() || jsonOut {
		return "", "", errors.New("hillpost team join needs a team id, see: hillpost team list")
	}
	var teams []api.Team
	if err := c.Query(ctx, "teams:list", map[string]any{"hackathonId": hackathonID}, &teams); err != nil {
		return "", "", err
	}
	if len(teams) == 0 {
		return "", "", errors.New("no teams yet, run: hillpost team create <name>")
	}
	chosen, ok, err := tui.Pick("Pick a team", teams, func(t api.Team) string {
		return t.Name + "  " + ui.Label.Render(memberCount(len(t.Members)))
	})
	if err != nil {
		return "", "", err
	}
	if !ok {
		return "", "", errors.New("cancelled")
	}
	return chosen.ID, chosen.Name, nil
}

// teamRows renders teams as table rows: name, member count, id.
func teamRows(teams []api.Team) [][]string {
	rows := make([][]string, 0, len(teams))
	for _, t := range teams {
		rows = append(rows, []string{t.Name, strconv.Itoa(len(t.Members)), t.ID})
	}
	return rows
}

// memberCount labels a team's size for the picker.
func memberCount(n int) string {
	if n == 1 {
		return "1 member"
	}
	return strconv.Itoa(n) + " members"
}
