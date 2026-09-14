package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
	"github.com/Hillpost/hillpost/cli/internal/tui"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var hackathonsCmd = &cobra.Command{
	Use:   "hackathons",
	Short: "List the hackathons you belong to",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "hackathons:listMine", nil, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}

		var hackathons []api.Hackathon
		if err := json.Unmarshal(raw, &hackathons); err != nil {
			return err
		}
		if len(hackathons) == 0 {
			fmt.Println(ui.Label.Render("No hackathons yet. Run: hillpost discover"))
			return nil
		}

		current := currentHackathonID(cfg)
		rows := make([][]string, 0, len(hackathons))
		for _, h := range hackathons {
			marker := " "
			if h.ID == current {
				marker = ui.Accent.Render("*")
			}
			rows = append(rows, []string{marker, h.Name, h.MyRole, activeLabel(h.IsActive), h.ID})
		}
		fmt.Print(ui.Table([]string{" ", "NAME", "ROLE", "ACTIVE", "ID"}, rows))
		if current != "" {
			fmt.Println("\n" + ui.Label.Render("* current hackathon"))
		}
		return nil
	},
}

var discoverCmd = &cobra.Command{
	Use:   "discover",
	Short: "List public hackathons anyone can join",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := client()
		if err != nil {
			return err
		}
		// Public listings do not need a login, but send the token when we have
		// one so the backend sees who is asking.
		c.Token = cfg.EffectiveToken()
		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "hackathons:listPublic", nil, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}

		var hackathons []api.Hackathon
		if err := json.Unmarshal(raw, &hackathons); err != nil {
			return err
		}
		if len(hackathons) == 0 {
			fmt.Println(ui.Label.Render("No public hackathons are open right now."))
			return nil
		}
		rows := make([][]string, 0, len(hackathons))
		for _, h := range hackathons {
			rows = append(rows, []string{h.Name, ui.Date(int64(h.StartDate)), ui.Date(int64(h.EndDate)), h.ID})
		}
		fmt.Print(ui.Table([]string{"NAME", "STARTS", "ENDS", "ID"}, rows))
		fmt.Println("\n" + ui.Label.Render("Join one with: hillpost join --public <id>"))
		return nil
	},
}

var useCmd = &cobra.Command{
	Use:   "use [id|code]",
	Short: "Set the hackathon other commands act on",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, cfg, err := authedClient()
		if err != nil {
			return err
		}
		if len(args) == 0 {
			return usePicker(cmd.Context(), c, cfg)
		}

		path, argMap := "hackathons:get", map[string]any{"hackathonId": args[0]}
		if !looksLikeID(args[0]) {
			path, argMap = "hackathons:getByJoinCode", map[string]any{"joinCode": args[0]}
		}
		var h *api.Hackathon
		if err := c.Query(cmd.Context(), path, argMap, &h); err != nil {
			return err
		}
		if h == nil {
			return fmt.Errorf("no hackathon found for %q", args[0])
		}
		return setCurrent(cfg, h.ID, h.Name)
	},
}

func init() {
	rootCmd.AddCommand(hackathonsCmd, discoverCmd, useCmd)
}

func usePicker(ctx context.Context, c *api.Client, cfg config.Config) error {
	var hackathons []api.Hackathon
	if err := c.Query(ctx, "hackathons:listMine", nil, &hackathons); err != nil {
		return err
	}
	if len(hackathons) == 0 {
		return errors.New("you have not joined any hackathons yet, run: hillpost discover")
	}
	if !ui.IsTTY() {
		return errors.New("no hackathon given, pass an id or join code")
	}

	chosen, ok, err := tui.Pick("Pick a hackathon", hackathons, func(h api.Hackathon) string {
		return h.Name + "  " + ui.Label.Render(h.MyRole)
	})
	if err != nil {
		return err
	}
	if !ok {
		return errors.New("cancelled")
	}
	return setCurrent(cfg, chosen.ID, chosen.Name)
}

func setCurrent(cfg config.Config, id, name string) error {
	cfg.HackathonID = id
	cfg.HackathonName = name
	if err := cfg.Save(); err != nil {
		return err
	}
	if jsonOut {
		raw, err := json.Marshal(map[string]any{"hackathonId": id, "name": name})
		if err != nil {
			return err
		}
		return ui.PrintJSON(raw)
	}
	fmt.Println(ui.Success.Render("Using " + name))
	return nil
}

// looksLikeID distinguishes a Convex document id from a six-character join code.
func looksLikeID(s string) bool { return len(s) > 6 }

func activeLabel(active bool) string {
	if active {
		return "yes"
	}
	return "no"
}
