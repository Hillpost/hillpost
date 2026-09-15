package cmd

import (
	"errors"
	"fmt"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/flow"
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
		joined, err := flow.Join(ctx, c, arg)
		if joinPublicFlag {
			joined, err = flow.JoinPublic(ctx, c, arg)
		}
		if err != nil {
			return err
		}

		if jsonOut {
			if err := ui.PrintJSON(joined.Raw); err != nil {
				return err
			}
		} else {
			fmt.Println(joinMessage(joined))
		}

		cfg.HackathonID = joined.Hackathon.ID
		cfg.HackathonName = joined.Hackathon.Name
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

// joinMessage says what joining did, and warns judges that they wait for an
// organizer before they can score.
func joinMessage(joined flow.Joined) string {
	if joined.AlreadyMember {
		return ui.Warn.Render("Already a member of " + joined.Hackathon.Name)
	}
	line := ui.Success.Render("Joined " + joined.Hackathon.Name + " as " + joined.Role)
	if joined.Role == "judge" {
		line += "\n" + ui.Label.Render("An organizer has to approve judges before you can score.")
	}
	return line
}
