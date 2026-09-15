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
	"github.com/Hillpost/hillpost/cli/internal/flow"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var hostCmd = &cobra.Command{
	Use:   "host",
	Short: "Run a hackathon: create it, share codes, manage members",
}

var (
	createFlags flow.NewHackathon
	createAs    string
)

var hostCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a hackathon and make it the current one",
	Long: "Create a hackathon. Pass the fields as flags, or run it in a terminal " +
		"with no --name to fill in a form.\n\n" +
		"Dates accept 2026-10-03, 2026-10-03T09:00 or a full RFC3339 timestamp, " +
		"and are read in local time.",
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()

		if createFlags.Name == "" {
			if jsonOut || !ui.IsTTY() {
				return errors.New("hillpost host create needs at least --name, --start and --end")
			}
			if err := flow.CreateForm(&createFlags).Run(); err != nil {
				return err
			}
		}

		name, err := organizerName(ctx, c)
		if err != nil {
			return err
		}
		h, raw, err := flow.Create(ctx, c, createFlags, name)
		if err != nil {
			return err
		}

		cfg.HackathonID = h.ID
		cfg.HackathonName = h.Name
		if err := cfg.Save(); err != nil {
			return err
		}

		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Created " + h.Name))
		ui.Field("id        ", h.ID)
		printCodes(h)
		fmt.Println("\n" + ui.Label.Render("It is now your current hackathon."))
		return nil
	},
}

var hostShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show the current hackathon's settings and counts",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()
		id, err := resolveHackathon(ctx, c, cfg)
		if err != nil {
			return err
		}

		var raw json.RawMessage
		if err := c.Query(ctx, "hackathons:get", map[string]any{"hackathonId": id}, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		var h *api.Hackathon
		if err := json.Unmarshal(raw, &h); err != nil {
			return err
		}
		if h == nil {
			return fmt.Errorf("no hackathon found for %q", id)
		}

		var members []api.Member
		if err := c.Query(ctx, "members:listMembers", map[string]any{"hackathonId": id}, &members); err != nil {
			return err
		}
		var categories []api.Category
		if err := c.Query(ctx, "categories:list", map[string]any{"hackathonId": id}, &categories); err != nil {
			return err
		}
		var submissions []api.Submission
		if err := c.Query(ctx, "submissions:list", map[string]any{"hackathonId": id}, &submissions); err != nil {
			return err
		}

		fmt.Println(ui.Title.Render(h.Name))
		if h.Description != "" {
			fmt.Println(ui.Value.Render(h.Description))
		}
		fmt.Println()
		ui.Field("id         ", h.ID)
		ui.Field("runs       ", ui.Date(h.StartDate)+" to "+ui.Date(h.EndDate))
		ui.Field("submissions", ui.Date(optional(h.SubmissionsStartDate, h.StartDate))+" to "+
			ui.Date(optional(h.SubmissionsEndDate, h.EndDate)))
		ui.Field("every      ", strconv.Itoa(h.SubmissionFrequencyMinutes.Int())+" minutes")
		ui.Field("active     ", activeLabel(h.IsActive))
		ui.Field("public     ", activeLabel(h.IsPublic))
		ui.Field("members    ", strconv.Itoa(len(members)))
		ui.Field("categories ", strconv.Itoa(len(categories)))
		ui.Field("submissions", strconv.Itoa(len(submissions)))
		return nil
	},
}

var hostCodesCmd = &cobra.Command{
	Use:   "codes",
	Short: "Show the competitor and judge join codes",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()
		id, err := resolveHackathon(ctx, c, cfg)
		if err != nil {
			return err
		}
		var h *api.Hackathon
		if err := c.Query(ctx, "hackathons:get", map[string]any{"hackathonId": id}, &h); err != nil {
			return err
		}
		if h == nil {
			return fmt.Errorf("no hackathon found for %q", id)
		}
		if jsonOut {
			codes, err := json.Marshal(map[string]any{
				"competitorJoinCode": h.CompetitorJoinCode,
				"judgeJoinCode":      h.JudgeJoinCode,
				"competitorUrl":      flow.JoinLink(h.CompetitorJoinCode),
				"judgeUrl":           flow.JoinLink(h.JudgeJoinCode),
			})
			if err != nil {
				return err
			}
			return ui.PrintJSON(codes)
		}
		if h.JudgeJoinCode == "" {
			return errors.New("Only organizers can see the judge join code")
		}
		fmt.Println(ui.Title.Render(h.Name))
		fmt.Println()
		printCodes(*h)
		return nil
	},
}

var settingsFlags struct {
	name            string
	description     string
	start           string
	end             string
	frequency       int
	public          bool
	active          bool
	feedbackVisible bool
	scoresVisible   string
}

var hostSettingsCmd = &cobra.Command{
	Use:   "settings",
	Short: "Change the current hackathon's settings",
	Long:  "Change only the settings you pass as flags. Dates are read in local time.",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		ctx := cmd.Context()
		id, err := resolveHackathon(ctx, c, cfg)
		if err != nil {
			return err
		}

		args := map[string]any{"hackathonId": id}
		flags := cmd.Flags()
		if flags.Changed("name") {
			args["name"] = settingsFlags.name
		}
		if flags.Changed("description") {
			args["description"] = settingsFlags.description
		}
		if flags.Changed("start") {
			ms, err := flow.ParseDate(settingsFlags.start)
			if err != nil {
				return err
			}
			args["startDate"] = ms
		}
		if flags.Changed("end") {
			ms, err := flow.ParseDate(settingsFlags.end)
			if err != nil {
				return err
			}
			args["endDate"] = ms
		}
		if flags.Changed("frequency") {
			args["submissionFrequencyMinutes"] = settingsFlags.frequency
		}
		if flags.Changed("public") {
			args["isPublic"] = settingsFlags.public
		}
		if flags.Changed("active") {
			args["isActive"] = settingsFlags.active
		}
		if flags.Changed("feedback-visible") {
			args["feedbackVisible"] = settingsFlags.feedbackVisible
		}
		if flags.Changed("scores-visible") {
			switch settingsFlags.scoresVisible {
			case "all", "judges", "none":
			default:
				return errors.New("--scores-visible must be all, judges or none")
			}
			args["scoresVisible"] = settingsFlags.scoresVisible
		}
		if len(args) == 1 {
			return errors.New("nothing to change, pass at least one setting (see: hillpost host settings --help)")
		}

		var raw json.RawMessage
		if err := c.Mutate(ctx, "hackathons:update", args, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Settings updated"))
		return nil
	},
}

func init() {
	f := hostCreateCmd.Flags()
	f.StringVar(&createFlags.Name, "name", "", "hackathon name")
	f.StringVar(&createFlags.Description, "description", "", "one paragraph about the hackathon")
	f.StringVar(&createFlags.Start, "start", "", "when the hackathon starts, e.g. 2026-10-03T09:00")
	f.StringVar(&createFlags.End, "end", "", "when the hackathon ends")
	f.StringVar(&createFlags.SubmissionsStart, "submissions-start", "", "when submissions open (default: the start)")
	f.StringVar(&createFlags.SubmissionsEnd, "submissions-end", "", "when submissions close (default: the end)")
	f.IntVar(&createFlags.Frequency, "frequency", 30, "minutes competitors must wait between submissions")
	f.BoolVar(&createFlags.Public, "public", false, "list it on the public discover page")
	f.StringVar(&createAs, "as", "", "your display name, when your account has none yet")

	s := hostSettingsCmd.Flags()
	s.StringVar(&settingsFlags.name, "name", "", "rename the hackathon")
	s.StringVar(&settingsFlags.description, "description", "", "replace the description")
	s.StringVar(&settingsFlags.start, "start", "", "move the start")
	s.StringVar(&settingsFlags.end, "end", "", "move the end")
	s.IntVar(&settingsFlags.frequency, "frequency", 30, "minutes between submissions")
	s.BoolVar(&settingsFlags.public, "public", false, "list it on the public discover page")
	s.BoolVar(&settingsFlags.active, "active", true, "whether the hackathon is running")
	s.BoolVar(&settingsFlags.feedbackVisible, "feedback-visible", false, "let competitors read judge feedback")
	s.StringVar(&settingsFlags.scoresVisible, "scores-visible", "", "who can see scores: all, judges or none")

	hostCmd.AddCommand(hostCreateCmd, hostShowCmd, hostCodesCmd, hostSettingsCmd)
	rootCmd.AddCommand(hostCmd)
}

// organizerName is the name to show on the organizer's membership, overridden
// by --as for an account that has no display name yet.
func organizerName(ctx context.Context, c *api.Client) (string, error) {
	if name := strings.TrimSpace(createAs); name != "" {
		return name, nil
	}
	return flow.OrganizerName(ctx, c)
}

func printCodes(h api.Hackathon) {
	ui.Field("competitor", ui.Code.Render(h.CompetitorJoinCode)+"  "+flow.JoinLink(h.CompetitorJoinCode))
	ui.Field("judge     ", ui.Code.Render(h.JudgeJoinCode)+"  "+flow.JoinLink(h.JudgeJoinCode))
}

func optional(value *api.Num, fallback api.Num) api.Num {
	if value == nil {
		return fallback
	}
	return *value
}
