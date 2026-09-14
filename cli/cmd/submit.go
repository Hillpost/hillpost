package cmd

import (
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// project is one submission as the user is editing it, before it is sent.
type project struct {
	name        string
	description string
	projectURL  string
	demoURL     string
	deployedURL string
	whatsNew    string
}

var submitFlags project

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

		var team *api.Team
		if err := c.Query(ctx, "teams:getMyTeam", map[string]any{"hackathonId": hackathonID}, &team); err != nil {
			return err
		}
		if team == nil {
			return errors.New("you are not on a team yet, run: hillpost team create <name>")
		}

		p := submitFlags
		if missing := missingSubmitFlags(p); len(missing) > 0 {
			if jsonOut || !ui.IsTTY() {
				return fmt.Errorf("hillpost submit needs %s", strings.Join(missing, ", "))
			}
			var latest *api.Submission
			if err := c.Query(ctx, "submissions:getLatestForTeam", map[string]any{
				"hackathonId": hackathonID,
				"teamId":      team.ID,
			}, &latest); err != nil {
				return err
			}
			if p, err = askProject(p, latest); err != nil {
				return err
			}
		}

		args := map[string]any{
			"hackathonId": hackathonID,
			"teamId":      team.ID,
			"name":        p.name,
			"description": p.description,
			"projectUrl":  p.projectURL,
		}
		// Convex rejects an explicit empty string where it expects an optional
		// field, so only send the ones the user filled in.
		for key, value := range optionalSubmitArgs(p) {
			args[key] = value
		}

		var submissionID string
		if err := c.Mutate(ctx, "submissions:create", args, &submissionID); err != nil {
			return err
		}

		// The mutation returns only an id; read the submission back for its
		// number, which is what the user wants to see.
		var raw json.RawMessage
		if err := c.Query(ctx, "submissions:get", map[string]any{"submissionId": submissionID}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		var saved api.Submission
		if err := json.Unmarshal(raw, &saved); err != nil {
			return err
		}
		fmt.Println(ui.Success.Render("Submitted " + saved.Name + " for " + team.Name))
		ui.Field("submission", "#"+strconv.Itoa(saved.SubmissionCount.Int()))
		ui.Field("id", saved.ID)
		return nil
	},
}

func init() {
	f := submitCmd.Flags()
	f.StringVar(&submitFlags.name, "name", "", "project name")
	f.StringVar(&submitFlags.description, "description", "", "what the project does")
	f.StringVar(&submitFlags.projectURL, "url", "", "source code `URL`")
	f.StringVar(&submitFlags.demoURL, "demo", "", "demo video `URL`")
	f.StringVar(&submitFlags.deployedURL, "deployed", "", "deployed app `URL`")
	f.StringVar(&submitFlags.whatsNew, "whats-new", "", "what changed since the last submission")
	rootCmd.AddCommand(submitCmd)
}

// missingSubmitFlags names the required flags that are still empty, so the
// error can tell the user exactly what to add.
func missingSubmitFlags(p project) []string {
	var missing []string
	for _, f := range []struct {
		flag  string
		value string
	}{
		{"--name", p.name},
		{"--description", p.description},
		{"--url", p.projectURL},
	} {
		if strings.TrimSpace(f.value) == "" {
			missing = append(missing, f.flag)
		}
	}
	return missing
}

// optionalSubmitArgs returns the submissions:create arguments that are only
// sent when the user filled them in.
func optionalSubmitArgs(p project) map[string]any {
	args := map[string]any{}
	for key, value := range map[string]string{
		"demoUrl":     p.demoURL,
		"deployedUrl": p.deployedURL,
		"whatsNew":    p.whatsNew,
	} {
		if v := strings.TrimSpace(value); v != "" {
			args[key] = v
		}
	}
	return args
}

// prefill fills p's empty fields from the team's last submission, so
// resubmitting only means saying what changed.
func prefill(p project, latest *api.Submission) project {
	if latest == nil {
		return p
	}
	for _, f := range []struct {
		field *string
		value string
	}{
		{&p.name, latest.Name},
		{&p.description, latest.Description},
		{&p.projectURL, latest.ProjectURL},
		{&p.demoURL, latest.DemoURL},
		{&p.deployedURL, latest.DeployedURL},
	} {
		if *f.field == "" {
			*f.field = f.value
		}
	}
	return p
}

// askProject opens the submission form. Callers must check for a terminal first.
func askProject(p project, latest *api.Submission) (project, error) {
	p = prefill(p, latest)

	fields := []huh.Field{
		huh.NewInput().Title("Project name").Value(&p.name),
		huh.NewText().Title("Description").Value(&p.description),
		huh.NewInput().Title("Source code URL").Placeholder("https://github.com/...").Value(&p.projectURL),
		huh.NewInput().Title("Demo video URL").Description("optional").Value(&p.demoURL),
		huh.NewInput().Title("Deployed URL").Description("optional").Value(&p.deployedURL),
	}
	if latest != nil {
		fields = append(fields, huh.NewText().
			Title("What is new").
			Description("shown to judges alongside submission #"+strconv.Itoa(latest.SubmissionCount.Int()+1)).
			Value(&p.whatsNew))
	}

	if err := huh.NewForm(huh.NewGroup(fields...)).Run(); err != nil {
		return p, err
	}
	if missing := missingSubmitFlags(p); len(missing) > 0 {
		return p, errors.New("a submission needs a name, a description and a source code URL")
	}
	return p, nil
}
