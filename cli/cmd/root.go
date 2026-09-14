// Package cmd defines the hillpost commands. Each file registers its own
// commands in init(), so new commands never touch this file.
package cmd

import (
	"errors"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

const version = "0.1.0"

var (
	jsonOut       bool
	hackathonFlag string
)

var rootCmd = &cobra.Command{
	Use:           "hillpost",
	Short:         "Join, run and judge hackathons from the terminal",
	Version:       version,
	SilenceUsage:  true,
	SilenceErrors: true,
}

func init() {
	rootCmd.PersistentFlags().BoolVar(&jsonOut, "json", false, "print raw JSON with no styling")
	rootCmd.PersistentFlags().StringVarP(&hackathonFlag, "hackathon", "H", "", "hackathon `id` to act on, overriding the one set by 'hillpost use'")
}

// errNotLoggedIn is returned whenever a command needs a token and none is set.
var errNotLoggedIn = errors.New("Not logged in. Run: hillpost login")

// Execute runs the CLI. Convex error messages are shown verbatim and every
// failure exits 1.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		var convexErr *api.Error
		switch {
		case errors.As(err, &convexErr):
			fmt.Fprintln(os.Stderr, convexErr.Message)
		case errors.Is(err, errNotLoggedIn):
			fmt.Fprintln(os.Stderr, err.Error())
		default:
			fmt.Fprintln(os.Stderr, ui.Danger.Render("Error: ")+err.Error())
		}
		os.Exit(1)
	}
}

// client returns a client for the configured deployment without a token.
func client() (*api.Client, config.Config, error) {
	cfg, err := config.Load()
	if err != nil {
		return nil, cfg, err
	}
	return api.New(cfg.EffectiveAPIURL(), ""), cfg, nil
}

// authedClient returns a client carrying the saved token, or errNotLoggedIn.
func authedClient() (*api.Client, config.Config, error) {
	c, cfg, err := client()
	if err != nil {
		return nil, cfg, err
	}
	token := cfg.EffectiveToken()
	if token == "" {
		return nil, cfg, errNotLoggedIn
	}
	c.Token = token
	return c, cfg, nil
}

// currentHackathonID is the -H flag when given, else the one saved by `hillpost use`.
func currentHackathonID(cfg config.Config) string {
	if hackathonFlag != "" {
		return hackathonFlag
	}
	return cfg.HackathonID
}
