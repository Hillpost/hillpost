package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/charmbracelet/huh"
	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// joinURL is where a join code sends someone in a browser.
const joinURL = "https://hillpost.dev/join/"

var hostCmd = &cobra.Command{
	Use:   "host",
	Short: "Run a hackathon: create it, share codes, manage members",
}

var createFlags struct {
	name             string
	description      string
	start            string
	end              string
	submissionsStart string
	submissionsEnd   string
	frequency        int
	public           bool
	as               string
}

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

		if createFlags.name == "" {
			if !ui.IsTTY() {
				return errors.New("hillpost host create needs at least --name, --start and --end")
			}
			if err := askCreate(); err != nil {
				return err
			}
		}

		args, err := createArgs()
		if err != nil {
			return err
		}
		name, err := organizerName(ctx, c)
		if err != nil {
			return err
		}
		args["userName"] = name

		var id string
		if err := c.Mutate(ctx, "hackathons:create", args, &id); err != nil {
			return err
		}

		// create returns only the id; get returns the join codes for organizers.
		var raw json.RawMessage
		if err := c.Query(ctx, "hackathons:get", map[string]any{"hackathonId": id}, &raw); err != nil {
			return err
		}
		var h api.Hackathon
		if err := json.Unmarshal(raw, &h); err != nil {
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
		ui.Field("id       ", h.ID)
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
		id, err := hostHackathonID(cfg)
		if err != nil {
			return err
		}
		ctx := cmd.Context()

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
		ui.Field("runs       ", ui.Date(int64(h.StartDate))+" to "+ui.Date(int64(h.EndDate)))
		ui.Field("submissions", ui.Date(optional(h.SubmissionsStartDate, h.StartDate))+" to "+
			ui.Date(optional(h.SubmissionsEndDate, h.EndDate)))
		ui.Field("every      ", strconv.FormatInt(int64(h.SubmissionFrequencyMinutes), 10)+" minutes")
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
		id, err := hostHackathonID(cfg)
		if err != nil {
			return err
		}
		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "hackathons:get", map[string]any{"hackathonId": id}, &raw); err != nil {
			return err
		}
		var h *api.Hackathon
		if err := json.Unmarshal(raw, &h); err != nil {
			return err
		}
		if h == nil {
			return fmt.Errorf("no hackathon found for %q", id)
		}
		if jsonOut {
			codes, err := json.Marshal(map[string]any{
				"competitorJoinCode": h.CompetitorJoinCode,
				"judgeJoinCode":      h.JudgeJoinCode,
				"competitorUrl":      joinLink(h.CompetitorJoinCode),
				"judgeUrl":           joinLink(h.JudgeJoinCode),
			})
			if err != nil {
				return err
			}
			return ui.PrintJSON(codes)
		}
		if h.JudgeJoinCode == "" {
			return errors.New("Only organizers can see join codes")
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
		id, err := hostHackathonID(cfg)
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
			ms, err := parseDate(settingsFlags.start)
			if err != nil {
				return err
			}
			args["startDate"] = ms
		}
		if flags.Changed("end") {
			ms, err := parseDate(settingsFlags.end)
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
		if err := c.Mutate(cmd.Context(), "hackathons:update", args, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}
		fmt.Println(ui.Success.Render("Settings updated"))
		return nil
	},
}

var hostSubmissionsCmd = &cobra.Command{
	Use:   "submissions",
	Short: "List every submission in the current hackathon",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		id, err := hostHackathonID(cfg)
		if err != nil {
			return err
		}
		ctx := cmd.Context()

		var raw json.RawMessage
		if err := c.Query(ctx, "submissions:list", map[string]any{"hackathonId": id}, &raw); err != nil {
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
			fmt.Println(ui.Label.Render("No submissions yet."))
			return nil
		}

		var teams []api.Team
		if err := c.Query(ctx, "teams:list", map[string]any{"hackathonId": id}, &teams); err != nil {
			return err
		}
		teamNames := make(map[string]string, len(teams))
		for _, t := range teams {
			teamNames[t.ID] = t.Name
		}

		rows := make([][]string, 0, len(submissions))
		for _, s := range submissions {
			rows = append(rows, []string{
				s.Name,
				teamNames[s.TeamID],
				ui.Date(int64(s.SubmittedAt)),
				strconv.FormatInt(int64(s.SubmissionCount), 10),
				strconv.Itoa(len(s.JudgedBy)),
				s.ID,
			})
		}
		fmt.Print(ui.Table([]string{"PROJECT", "TEAM", "SUBMITTED", "ITERATION", "SCORED BY", "ID"}, rows))
		return nil
	},
}

func init() {
	f := hostCreateCmd.Flags()
	f.StringVar(&createFlags.name, "name", "", "hackathon name")
	f.StringVar(&createFlags.description, "description", "", "one paragraph about the hackathon")
	f.StringVar(&createFlags.start, "start", "", "when the hackathon starts, e.g. 2026-10-03T09:00")
	f.StringVar(&createFlags.end, "end", "", "when the hackathon ends")
	f.StringVar(&createFlags.submissionsStart, "submissions-start", "", "when submissions open (default: the start)")
	f.StringVar(&createFlags.submissionsEnd, "submissions-end", "", "when submissions close (default: the end)")
	f.IntVar(&createFlags.frequency, "frequency", 30, "minutes competitors must wait between submissions")
	f.BoolVar(&createFlags.public, "public", false, "list it on the public discover page")
	f.StringVar(&createFlags.as, "as", "", "your display name, when your account has none yet")

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

	hostCmd.AddCommand(hostCreateCmd, hostShowCmd, hostCodesCmd, hostSettingsCmd, hostSubmissionsCmd)
	rootCmd.AddCommand(hostCmd)
}

// hostHackathonID is the hackathon organizer commands act on: -H when given,
// else the one set by `hillpost use`.
func hostHackathonID(cfg config.Config) (string, error) {
	id := currentHackathonID(cfg)
	if id == "" {
		return "", errors.New("no current hackathon, pass -H <id> or run: hillpost use")
	}
	return id, nil
}

// parseDate reads 2026-10-03, 2026-10-03T09:00 or a full RFC3339 timestamp and
// returns milliseconds since the epoch. Values without a zone are local time.
func parseDate(s string) (int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, errors.New("no date given")
	}
	for _, layout := range []string{"2006-01-02", "2006-01-02T15:04", "2006-01-02T15:04:05"} {
		if t, err := time.ParseInLocation(layout, s, time.Local); err == nil {
			return t.UnixMilli(), nil
		}
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UnixMilli(), nil
	}
	return 0, fmt.Errorf("cannot read the date %q, use 2026-10-03, 2026-10-03T09:00 or an RFC3339 timestamp", s)
}

// createArgs turns the create flags into hackathons:create arguments.
func createArgs() (map[string]any, error) {
	if strings.TrimSpace(createFlags.name) == "" {
		return nil, errors.New("hillpost host create needs --name")
	}
	if createFlags.start == "" || createFlags.end == "" {
		return nil, errors.New("hillpost host create needs --start and --end")
	}
	start, err := parseDate(createFlags.start)
	if err != nil {
		return nil, err
	}
	end, err := parseDate(createFlags.end)
	if err != nil {
		return nil, err
	}
	args := map[string]any{
		"name":                       strings.TrimSpace(createFlags.name),
		"description":                createFlags.description,
		"startDate":                  start,
		"endDate":                    end,
		"submissionFrequencyMinutes": createFlags.frequency,
		"isPublic":                   createFlags.public,
	}
	if createFlags.submissionsStart != "" {
		ms, err := parseDate(createFlags.submissionsStart)
		if err != nil {
			return nil, err
		}
		args["submissionsStartDate"] = ms
	}
	if createFlags.submissionsEnd != "" {
		ms, err := parseDate(createFlags.submissionsEnd)
		if err != nil {
			return nil, err
		}
		args["submissionsEndDate"] = ms
	}
	return args, nil
}

// askCreate fills the create flags from a form. Only runs on a terminal.
func askCreate() error {
	frequency := strconv.Itoa(createFlags.frequency)
	form := huh.NewForm(huh.NewGroup(
		huh.NewInput().Title("Name").Value(&createFlags.name),
		huh.NewInput().Title("Description").Value(&createFlags.description),
		huh.NewInput().Title("Starts").Placeholder("2026-10-03T09:00").Value(&createFlags.start),
		huh.NewInput().Title("Ends").Placeholder("2026-10-05T17:00").Value(&createFlags.end),
		huh.NewInput().Title("Minutes between submissions").Value(&frequency),
		huh.NewConfirm().Title("List it publicly?").Value(&createFlags.public),
	))
	if err := form.Run(); err != nil {
		return err
	}
	minutes, err := strconv.Atoi(strings.TrimSpace(frequency))
	if err != nil || minutes <= 0 {
		return fmt.Errorf("minutes between submissions must be a positive number, got %q", frequency)
	}
	createFlags.frequency = minutes
	return nil
}

// organizerName is the name to show on the organizer's membership. CLI tokens
// carry no profile, so fall back to the name the account already uses.
func organizerName(ctx context.Context, c *api.Client) (string, error) {
	if name := strings.TrimSpace(createFlags.as); name != "" {
		return name, nil
	}
	var me api.WhoAmI
	if err := c.Query(ctx, "cli:whoami", nil, &me); err != nil {
		return "", err
	}
	if strings.TrimSpace(me.UserName) == "" {
		return "", errors.New("your account has no display name yet, pass --as \"Your Name\"")
	}
	return me.UserName, nil
}

func printCodes(h api.Hackathon) {
	ui.Field("competitor", ui.Code.Render(h.CompetitorJoinCode)+"  "+joinLink(h.CompetitorJoinCode))
	ui.Field("judge     ", ui.Code.Render(h.JudgeJoinCode)+"  "+joinLink(h.JudgeJoinCode))
}

func joinLink(code string) string {
	if code == "" {
		return ""
	}
	return joinURL + code
}

func optional(value *api.Number, fallback api.Number) int64 {
	if value == nil {
		return int64(fallback)
	}
	return int64(*value)
}
