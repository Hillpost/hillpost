package cmd

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var submissionsCmd = &cobra.Command{
	Use:   "submissions",
	Short: "List the current hackathon's submissions",
	Args:  cobra.NoArgs,
	RunE:  runSubmissionsList,
}

var submissionsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List the current hackathon's submissions",
	Args:  cobra.NoArgs,
	RunE:  runSubmissionsList,
}

var submissionsShowCmd = &cobra.Command{
	Use:   "show <id>",
	Short: "Show one submission and any judge feedback",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()

		var raw json.RawMessage
		if err := c.Query(ctx, "submissions:get", map[string]any{"submissionId": args[0]}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}

		var submission *api.Submission
		if err := json.Unmarshal(raw, &submission); err != nil {
			return err
		}
		if submission == nil {
			return fmt.Errorf("no submission found for %q", args[0])
		}

		fmt.Println(ui.Title.Render(submission.Name))
		ui.Field("submission", "#"+strconv.Itoa(submission.SubmissionCount.Int()))
		ui.Field("submitted ", ui.Date(submission.SubmittedAt))
		ui.Field("source    ", submission.ProjectURL)
		if submission.DemoURL != "" {
			ui.Field("demo      ", submission.DemoURL)
		}
		if submission.DeployedURL != "" {
			ui.Field("deployed  ", submission.DeployedURL)
		}
		fmt.Println("\n" + ui.Value.Render(submission.Description))
		printChangelog(submission.Changelog)

		// Feedback is not always available: judges may not have scored yet, or
		// the organizer may be holding scores back. That is not an error.
		var feedback *api.Feedback
		if err := c.Query(ctx, "scores:getFeedbackForSubmission", map[string]any{"submissionId": submission.ID}, &feedback); err != nil {
			return err
		}
		printFeedback(feedback)
		return nil
	},
}

func init() {
	submissionsCmd.AddCommand(submissionsListCmd, submissionsShowCmd)
	rootCmd.AddCommand(submissionsCmd)
}

func runSubmissionsList(cmd *cobra.Command, _ []string) error {
	c, cfg, err := authedClient()
	if err != nil {
		return err
	}
	hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
	if err != nil {
		return err
	}

	var raw json.RawMessage
	if err := c.Query(cmd.Context(), "submissions:list", map[string]any{"hackathonId": hackathonID}, &raw); err != nil {
		return err
	}
	if jsonOut {
		return ui.PrintJSON(raw)
	}

	var submissions []api.Submission
	if err := json.Unmarshal(raw, &submissions); err != nil {
		return err
	}
	if len(submissions) == 0 {
		fmt.Println(ui.Label.Render("No submissions yet. Run: hillpost submit"))
		return nil
	}

	var teams []api.Team
	if err := c.Query(cmd.Context(), "teams:list", map[string]any{"hackathonId": hackathonID}, &teams); err != nil {
		return err
	}
	fmt.Print(ui.Table([]string{"TEAM", "PROJECT", "N", "LAST", "ID"}, submissionRows(submissions, teamNames(teams))))
	return nil
}

// teamNames maps team ids to names so submissions can be listed by team.
func teamNames(teams []api.Team) map[string]string {
	names := make(map[string]string, len(teams))
	for _, t := range teams {
		names[t.ID] = t.Name
	}
	return names
}

// submissionRows renders submissions as table rows. A team whose name is
// unknown is shown by id, which is still enough to look it up.
func submissionRows(submissions []api.Submission, names map[string]string) [][]string {
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

func printChangelog(entries []api.ChangelogEntry) {
	notes := make([][]string, 0, len(entries))
	for i := len(entries) - 1; i >= 0; i-- {
		e := entries[i]
		if strings.TrimSpace(e.WhatsNew) == "" {
			continue
		}
		notes = append(notes, []string{"#" + strconv.Itoa(e.SubmissionCount.Int()), ui.Date(e.SubmittedAt), e.WhatsNew})
	}
	if len(notes) == 0 {
		return
	}
	fmt.Println("\n" + ui.Header.Render("CHANGELOG"))
	fmt.Print(ui.Table([]string{"N", "WHEN", "WHAT IS NEW"}, notes))
}

func printFeedback(f *api.Feedback) {
	if f == nil {
		fmt.Println("\n" + ui.Label.Render("No feedback available."))
		return
	}
	if f.FeedbackHidden {
		fmt.Println("\n" + ui.Label.Render("Feedback is hidden by the organizer."))
		return
	}
	if len(f.Iterations) == 0 {
		fmt.Println("\n" + ui.Label.Render("No judge has scored this submission yet."))
		return
	}

	categories := make(map[string]api.FeedbackCategory, len(f.Categories))
	for _, c := range f.Categories {
		categories[c.ID] = c
	}

	for _, iter := range f.Iterations {
		fmt.Println("\n" + ui.Header.Render("FEEDBACK ON SUBMISSION #"+strconv.Itoa(iter.SubmissionCount.Int())))
		for _, judge := range iter.Judges {
			fmt.Println(ui.Accent.Render(judge.Label))
			for _, cs := range judge.CategoryScores {
				if cs.Score == nil {
					continue
				}
				category := categories[cs.CategoryID]
				line := fmt.Sprintf("%s  %s / %s", category.Name, formatScore(*cs.Score), formatScore(category.MaxScore))
				if cs.Feedback != nil && strings.TrimSpace(*cs.Feedback) != "" {
					line += "  " + ui.Label.Render(strings.TrimSpace(*cs.Feedback))
				}
				fmt.Println("  " + ui.Value.Render(line))
			}
		}
	}
}
