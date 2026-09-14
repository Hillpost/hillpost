package cmd

import (
	"context"
	"errors"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
	"github.com/Hillpost/hillpost/cli/internal/tui"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// errNoHackathon is returned when a command needs a hackathon and nothing
// selected one.
var errNoHackathon = errors.New("No hackathon selected. Run: hillpost use <id|code>, or pass -H <id>")

// resolveHackathon returns the hackathon every command acts on: the -H flag,
// else the one saved by `hillpost use`, else, on a terminal, one the user picks
// from the hackathons they belong to. The picked id is not saved; use
// `hillpost use` for that.
func resolveHackathon(ctx context.Context, c *api.Client, cfg config.Config) (string, error) {
	if id := currentHackathonID(cfg); id != "" {
		return id, nil
	}
	if jsonOut || !ui.IsTTY() {
		return "", errNoHackathon
	}

	var hackathons []api.Hackathon
	if err := c.Query(ctx, "hackathons:listMine", nil, &hackathons); err != nil {
		return "", err
	}
	if len(hackathons) == 0 {
		return "", errors.New("you have not joined any hackathons yet, run: hillpost discover")
	}

	chosen, ok, err := tui.Pick("Pick a hackathon", hackathons, func(h api.Hackathon) string {
		return h.Name + "  " + ui.Label.Render(h.MyRole)
	})
	if err != nil {
		return "", err
	}
	if !ok {
		return "", errors.New("cancelled")
	}
	return chosen.ID, nil
}
