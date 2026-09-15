package cmd

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/flow"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var submitFlags flow.Project

var submitCmd = &cobra.Command{
	Use:   "submit",
	Short: "Submit or resubmit your team's project",
	Long: "Submit your team's project to the current hackathon. With --name, --description and --url\n" +
		"it submits straight away; otherwise it opens a form pre-filled with your last submission.",
	Args: cobra.NoArgs,
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

		team, err := flow.MyTeam(ctx, c, hackathonID)
		if err != nil {
			return err
		}
		if team == nil {
			return errors.New("you are not on a team yet, run: hillpost team create <name>")
		}

		p := submitFlags
		if missing := p.Missing(); len(missing) > 0 {
			if jsonOut || !ui.IsTTY() {
				return fmt.Errorf("hillpost submit needs %s", strings.Join(missing, ", "))
			}
			latest, err := flow.LatestSubmission(ctx, c, hackathonID, team.ID)
			if err != nil {
				return err
			}
			if err := flow.SubmitForm(&p, latest).Run(); err != nil {
				return err
			}
			if len(p.Missing()) > 0 {
				return flow.ErrIncomplete
			}
		}

		saved, raw, err := flow.Submit(ctx, c, hackathonID, team.ID, p)
		if err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Submitted " + saved.Name + " for " + team.Name))
		ui.Field("submission", "#"+strconv.Itoa(saved.SubmissionCount.Int()))
		ui.Field("id", saved.ID)
		return nil
	},
}

func init() {
	f := submitCmd.Flags()
	f.StringVar(&submitFlags.Name, "name", "", "project name")
	f.StringVar(&submitFlags.Description, "description", "", "what the project does")
	f.StringVar(&submitFlags.ProjectURL, "url", "", "source code `URL`")
	f.StringVar(&submitFlags.DemoURL, "demo", "", "demo video `URL`")
	f.StringVar(&submitFlags.DeployedURL, "deployed", "", "deployed app `URL`")
	f.StringVar(&submitFlags.WhatsNew, "whats-new", "", "what changed since the last submission")
	rootCmd.AddCommand(submitCmd)
}
