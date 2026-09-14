package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/tui"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var (
	scoreCategory string
	scoreValue    float64
	scoreFeedback string
)

var judgeCmd = &cobra.Command{
	Use:   "judge",
	Short: "Score submissions as a judge",
	Long:  "Open the scoring screen, or use the subcommands to score without a terminal.",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		if !ui.IsTTY() {
			return errors.New("hillpost judge needs a terminal, try: hillpost judge list")
		}
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		hackathonID, err := resolveHackathon(cmd.Context(), c, cfg)
		if err != nil {
			return err
		}

		ctx := cmd.Context()
		var data tui.JudgeData
		data.HackathonName = cfg.HackathonName
		err = ui.Spin("Loading submissions", func() error {
			var me api.WhoAmI
			if err := c.Query(ctx, "cli:whoami", nil, &me); err != nil {
				return err
			}
			data.JudgeID = me.UserID
			data.Submissions, data.TeamNames, data.Categories, err = judgeContext(ctx, c, hackathonID)
			return err
		})
		if err != nil {
			return err
		}
		if len(data.Submissions) == 0 {
			fmt.Println(ui.Label.Render("No submissions to score yet."))
			return nil
		}

		_, err = tea.NewProgram(tui.NewJudge(c, data), tea.WithAltScreen()).Run()
		return err
	},
}

var judgeListCmd = &cobra.Command{
	Use:   "list",
	Short: "List the submissions you can score",
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
		ctx := cmd.Context()

		if jsonOut {
			var raw json.RawMessage
			if err := c.Query(ctx, "submissions:list", map[string]any{"hackathonId": hackathonID}, &raw); err != nil {
				return err
			}
			return ui.PrintJSON(raw)
		}

		var me api.WhoAmI
		if err := c.Query(ctx, "cli:whoami", nil, &me); err != nil {
			return err
		}
		submissions, teamNames, _, err := judgeContext(ctx, c, hackathonID)
		if err != nil {
			return err
		}
		if len(submissions) == 0 {
			fmt.Println(ui.Label.Render("No submissions yet."))
			return nil
		}

		rows := make([][]string, 0, len(submissions))
		for _, s := range submissions {
			mark := " "
			if scoredBy(s, me.UserID) {
				mark = ui.Success.Render("x")
			}
			team := teamNames[s.TeamID]
			if team == "" {
				team = "unknown team"
			}
			rows = append(rows, []string{mark, team, s.Name, strconv.Itoa(s.SubmissionCount.Int()), ui.Date(s.SubmittedAt), s.ID})
		}
		fmt.Print(ui.Table([]string{" ", "TEAM", "PROJECT", "ITER", "SUBMITTED", "ID"}, rows))
		fmt.Println("\n" + ui.Label.Render("x  you have scored this iteration. Score one with: hillpost judge"))
		return nil
	},
}

var judgeScoreCmd = &cobra.Command{
	Use:   "score <submissionId>",
	Short: "Score one category of one submission",
	Long:  "Score a single category. --category takes a category id or its name, ignoring case.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()

		submission, err := getSubmission(ctx, c, args[0])
		if err != nil {
			return err
		}
		var categories []api.Category
		if err := c.Query(ctx, "categories:list", map[string]any{"hackathonId": submission.HackathonID}, &categories); err != nil {
			return err
		}
		category, err := api.MatchCategory(categories, scoreCategory)
		if err != nil {
			return err
		}
		if err := api.ValidateScore(scoreValue, category.MaxScore); err != nil {
			return err
		}

		mutArgs := map[string]any{
			"submissionId": submission.ID,
			"categoryId":   category.ID,
			"score":        scoreValue,
		}
		if scoreFeedback != "" {
			mutArgs["feedback"] = scoreFeedback
		}
		var raw json.RawMessage
		if err := c.Mutate(ctx, "scores:submit", mutArgs, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render(fmt.Sprintf("Scored %s %s/%s on %s",
			submission.Name, ui.Number(scoreValue), ui.Number(category.MaxScore), category.Name)))
		return nil
	},
}

var judgeScoresCmd = &cobra.Command{
	Use:   "scores <submissionId>",
	Short: "Show your scores for a submission, and the averages when visible",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()

		if jsonOut {
			var mine, all json.RawMessage
			if err := c.Query(ctx, "scores:getMyScoresForSubmission", map[string]any{"submissionId": args[0]}, &mine); err != nil {
				return err
			}
			if err := c.Query(ctx, "scores:getForSubmission", map[string]any{"submissionId": args[0]}, &all); err != nil {
				return err
			}
			raw, err := json.Marshal(map[string]json.RawMessage{"mine": mine, "all": all})
			if err != nil {
				return err
			}
			return ui.PrintJSON(raw)
		}

		submission, err := getSubmission(ctx, c, args[0])
		if err != nil {
			return err
		}
		var categories []api.Category
		if err := c.Query(ctx, "categories:list", map[string]any{"hackathonId": submission.HackathonID}, &categories); err != nil {
			return err
		}
		var mine []api.Score
		if err := c.Query(ctx, "scores:getMyScoresForSubmission", map[string]any{"submissionId": submission.ID}, &mine); err != nil {
			return err
		}
		var all api.ScoreSummary
		if err := c.Query(ctx, "scores:getForSubmission", map[string]any{"submissionId": submission.ID}, &all); err != nil {
			return err
		}

		myScore := make(map[string]api.Score, len(mine))
		for _, s := range mine {
			myScore[s.CategoryID] = s
		}
		average := make(map[string]api.ScoreEntry, len(all.Entries))
		for _, e := range all.Entries {
			average[e.CategoryID] = e
		}

		fmt.Println(ui.Title.Render(submission.Name) + "  " + ui.Label.Render("iteration "+strconv.Itoa(submission.SubmissionCount.Int())))
		fmt.Println()
		rows := make([][]string, 0, len(categories))
		for _, cat := range categories {
			mineCell := "-"
			if s, ok := myScore[cat.ID]; ok {
				mineCell = ui.Number(s.Score) + "/" + ui.Number(cat.MaxScore)
			}
			averageCell, judges := "-", "-"
			if all.ScoresHidden {
				averageCell, judges = "hidden", "hidden"
			} else if e, ok := average[cat.ID]; ok {
				averageCell = ui.Number(e.AverageScore) + "/" + ui.Number(cat.MaxScore)
				judges = strconv.Itoa(e.JudgeCount.Int())
			}
			rows = append(rows, []string{cat.Name, mineCell, averageCell, judges})
		}
		fmt.Print(ui.Table([]string{"CATEGORY", "MINE", "AVERAGE", "JUDGES"}, rows))

		for _, cat := range categories {
			if s, ok := myScore[cat.ID]; ok && s.Feedback != "" {
				fmt.Println()
				fmt.Println(ui.Header.Render(cat.Name+" feedback") + "\n" + ui.Value.Render(s.Feedback))
			}
		}
		if all.ScoresHidden {
			fmt.Println("\n" + ui.Label.Render("This hackathon hides other judges' scores from you."))
		}
		return nil
	},
}

func init() {
	judgeScoreCmd.Flags().StringVar(&scoreCategory, "category", "", "category `id or name` to score")
	judgeScoreCmd.Flags().Float64Var(&scoreValue, "score", 0, "score to give, from 1 to the category maximum")
	judgeScoreCmd.Flags().StringVar(&scoreFeedback, "feedback", "", "feedback to leave with the score")
	_ = judgeScoreCmd.MarkFlagRequired("category")
	_ = judgeScoreCmd.MarkFlagRequired("score")

	judgeCmd.AddCommand(judgeListCmd, judgeScoreCmd, judgeScoresCmd)
	rootCmd.AddCommand(judgeCmd)
}

// judgeContext loads everything the submission list shows: the submissions
// themselves, their team names and the hackathon's categories.
func judgeContext(ctx context.Context, c *api.Client, hackathonID string) ([]api.Submission, map[string]string, []api.Category, error) {
	var submissions []api.Submission
	if err := c.Query(ctx, "submissions:list", map[string]any{"hackathonId": hackathonID}, &submissions); err != nil {
		return nil, nil, nil, err
	}
	var teams []api.Team
	if err := c.Query(ctx, "teams:list", map[string]any{"hackathonId": hackathonID}, &teams); err != nil {
		return nil, nil, nil, err
	}
	var categories []api.Category
	if err := c.Query(ctx, "categories:list", map[string]any{"hackathonId": hackathonID}, &categories); err != nil {
		return nil, nil, nil, err
	}

	names := make(map[string]string, len(teams))
	for _, t := range teams {
		names[t.ID] = t.Name
	}
	sort.SliceStable(submissions, func(i, j int) bool {
		return strings.ToLower(names[submissions[i].TeamID]) < strings.ToLower(names[submissions[j].TeamID])
	})
	return submissions, names, categories, nil
}

func getSubmission(ctx context.Context, c *api.Client, id string) (api.Submission, error) {
	var submission *api.Submission
	if err := c.Query(ctx, "submissions:get", map[string]any{"submissionId": id}, &submission); err != nil {
		return api.Submission{}, err
	}
	if submission == nil {
		return api.Submission{}, fmt.Errorf("no submission %q, or you cannot see it", id)
	}
	return *submission, nil
}

func scoredBy(s api.Submission, userID string) bool {
	for _, id := range s.JudgedBy {
		if id == userID {
			return true
		}
	}
	return false
}
