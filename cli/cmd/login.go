package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

var loginToken string

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Log in to Hillpost",
	Long:  "Log in by approving a code in the browser, or pass --token for CI.",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, cfg, err := client()
		if err != nil {
			return err
		}
		if loginToken != "" {
			return loginWithToken(cmd.Context(), c, cfg)
		}
		return loginWithDevice(cmd.Context(), c, cfg)
	},
}

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Forget the saved token",
	Args:  cobra.NoArgs,
	RunE: func(*cobra.Command, []string) error {
		cfg, err := config.Load()
		if err != nil {
			return err
		}
		cfg.Token = ""
		if err := cfg.Save(); err != nil {
			return err
		}
		fmt.Println(ui.Success.Render("Logged out."))
		return nil
	},
}

var whoamiCmd = &cobra.Command{
	Use:   "whoami",
	Short: "Show the logged-in user and their hackathons",
	Args:  cobra.NoArgs,
	RunE: func(cmd *cobra.Command, _ []string) error {
		c, _, err := authedClient()
		if err != nil {
			return err
		}
		var raw json.RawMessage
		if err := c.Query(cmd.Context(), "cli:whoami", nil, &raw); err != nil {
			return err
		}
		if jsonOut {
			return ui.PrintJSON(raw)
		}

		var me api.WhoAmI
		if err := json.Unmarshal(raw, &me); err != nil {
			return err
		}
		fmt.Println(ui.Title.Render(me.UserName))
		ui.Field("user id", me.UserID)
		if len(me.Memberships) == 0 {
			fmt.Println("\n" + ui.Label.Render("No hackathons yet. Run: hillpost discover"))
			return nil
		}
		rows := make([][]string, 0, len(me.Memberships))
		for _, m := range me.Memberships {
			rows = append(rows, []string{m.Name, m.Role, m.Status})
		}
		fmt.Println()
		fmt.Print(ui.Table([]string{"HACKATHON", "ROLE", "STATUS"}, rows))
		return nil
	},
}

func init() {
	loginCmd.Flags().StringVar(&loginToken, "token", "", "log in with an existing token instead of the browser flow")
	rootCmd.AddCommand(loginCmd, logoutCmd, whoamiCmd)
}

func loginWithToken(ctx context.Context, c *api.Client, cfg config.Config) error {
	c.Token = loginToken
	var me api.WhoAmI
	if err := c.Query(ctx, "cli:whoami", nil, &me); err != nil {
		return err
	}
	cfg.Token = loginToken
	if err := cfg.Save(); err != nil {
		return err
	}
	return reportLogin(me.UserName)
}

func loginWithDevice(ctx context.Context, c *api.Client, cfg config.Config) error {
	var device api.DeviceLogin
	if err := c.Mutate(ctx, "cli:startDeviceLogin", nil, &device); err != nil {
		return err
	}

	fmt.Println(ui.Title.Render("Authorize this terminal"))
	ui.Field("code", ui.Code.Render(device.UserCode))
	ui.Field("open", device.VerificationURL)
	fmt.Println()
	ui.OpenURL(device.VerificationURL)

	interval := time.Duration(device.Interval) * time.Second
	if interval <= 0 {
		interval = 2 * time.Second
	}

	var claim api.DeviceClaim
	err := ui.Spin("Waiting for approval in the browser", func() error {
		for {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(interval):
			}
			var c2 api.DeviceClaim
			if err := c.Mutate(ctx, "cli:claimDevice", map[string]any{"deviceCode": device.DeviceCode}, &c2); err != nil {
				return err
			}
			switch c2.Status {
			case "approved":
				claim = c2
				return nil
			case "expired":
				return errors.New("the login code expired, run hillpost login again")
			}
		}
	})
	if err != nil {
		return err
	}

	cfg.Token = claim.Token
	if err := cfg.Save(); err != nil {
		return err
	}
	return reportLogin(claim.UserName)
}

func reportLogin(userName string) error {
	if jsonOut {
		raw, err := json.Marshal(map[string]any{"loggedIn": true, "userName": userName})
		if err != nil {
			return err
		}
		return ui.PrintJSON(raw)
	}
	fmt.Println(ui.Success.Render("Logged in as " + userName))
	return nil
}
