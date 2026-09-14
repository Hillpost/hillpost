package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var joinPublicFlag bool

var joinCmd = &cobra.Command{
	Use:   "join [code]",
	Short: "Join a hackathon with an invite code",
	Long:  "Join a hackathon with a competitor or judge invite code, or with --public and a hackathon id.",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}

		arg := ""
		if len(args) == 1 {
			arg = strings.TrimSpace(args[0])
		}
		if arg == "" {
			if joinPublicFlag {
				return errors.New("hillpost join --public needs a hackathon id, see: hillpost discover")
			}
			arg, err = askJoinCode()
			if err != nil {
				return err
			}
		}

		ctx := cmd.Context()
		path, argMap := "hackathons:join", map[string]any{"joinCode": arg}
		if joinPublicFlag {
			path, argMap = "hackathons:joinPublic", map[string]any{"hackathonId": arg}
		}

		// Look the hackathon up first: the join mutation returns only an id, and
		// this is also what tells us whether the code is a judge code.
		var found *api.Hackathon
		lookupPath, lookupArgs := "hackathons:getByJoinCode", map[string]any{"joinCode": arg}
		if joinPublicFlag {
			lookupPath, lookupArgs = "hackathons:get", map[string]any{"hackathonId": arg}
		}
		if err := c.Query(ctx, lookupPath, lookupArgs, &found); err != nil {
			return err
		}
		if found == nil {
			return fmt.Errorf("no hackathon found for %q", arg)
		}

		var raw json.RawMessage
		if err := c.Mutate(ctx, path, argMap, &raw); err != nil {
			return err
		}
		if jsonOut {
			if err := ui.PrintJSON(raw); err != nil {
				return err
			}
		}

		var result api.JoinResult
		if err := json.Unmarshal(raw, &result); err != nil {
			return err
		}

		role := found.Role
		if role == "" {
			role = "competitor"
		}
		if !jsonOut {
			if result.AlreadyMember {
				fmt.Println(ui.Warn.Render("Already a member of " + found.Name))
			} else {
				fmt.Println(ui.Success.Render("Joined " + found.Name + " as " + role))
			}
			if role == "judge" && !result.AlreadyMember {
				fmt.Println(ui.Label.Render("An organizer has to approve judges before you can score."))
			}
		}

		cfg.HackathonID = result.HackathonID
		cfg.HackathonName = found.Name
		return cfg.Save()
	},
}

func init() {
	joinCmd.Flags().BoolVar(&joinPublicFlag, "public", false, "join a public hackathon by id instead of by code")
	rootCmd.AddCommand(joinCmd)
}

func askJoinCode() (string, error) {
	if !ui.IsTTY() {
		return "", errors.New("hillpost join needs a join code")
	}
	var code string
	form := huh.NewForm(huh.NewGroup(
		huh.NewInput().Title("Join code").Placeholder("6 characters from the organizer").Value(&code),
	))
	if err := form.Run(); err != nil {
		return "", err
	}
	code = strings.TrimSpace(code)
	if code == "" {
		return "", errors.New("no join code given")
	}
	return code, nil
}
