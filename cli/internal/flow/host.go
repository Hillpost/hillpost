package flow

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/charmbracelet/huh"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

// NewHackathon is a hackathon as the user is describing it. Dates are kept as
// the user typed them and read in local time by Args.
type NewHackathon struct {
	Name             string
	Description      string
	Start            string
	End              string
	SubmissionsStart string
	SubmissionsEnd   string
	Frequency        int
	Public           bool
}

// ParseDate reads 2026-10-03, 2026-10-03T09:00 or a full RFC3339 timestamp and
// returns milliseconds since the epoch. Values without a zone are local time.
func ParseDate(s string) (int64, error) {
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

// Args turns the description into hackathons:create arguments.
func (n NewHackathon) Args() (map[string]any, error) {
	if strings.TrimSpace(n.Name) == "" {
		return nil, errors.New("hillpost host create needs --name")
	}
	if n.Start == "" || n.End == "" {
		return nil, errors.New("hillpost host create needs --start and --end")
	}
	start, err := ParseDate(n.Start)
	if err != nil {
		return nil, err
	}
	end, err := ParseDate(n.End)
	if err != nil {
		return nil, err
	}
	args := map[string]any{
		"name":                       strings.TrimSpace(n.Name),
		"description":                n.Description,
		"startDate":                  start,
		"endDate":                    end,
		"submissionFrequencyMinutes": n.Frequency,
		"isPublic":                   n.Public,
	}
	for key, value := range map[string]string{
		"submissionsStartDate": n.SubmissionsStart,
		"submissionsEndDate":   n.SubmissionsEnd,
	} {
		if value == "" {
			continue
		}
		ms, err := ParseDate(value)
		if err != nil {
			return nil, err
		}
		args[key] = ms
	}
	return args, nil
}

// CreateForm builds the create form over n. Every field is checked as the user
// leaves it, so n is ready for Args once the form completes. Run it with
// form.Run(), or embed it by setting its SubmitCmd and CancelCmd.
func CreateForm(n *NewHackathon) *huh.Form {
	if n.Frequency <= 0 {
		n.Frequency = 30
	}
	minutes := strconv.Itoa(n.Frequency)
	date := func(s string) error {
		_, err := ParseDate(s)
		return err
	}

	return huh.NewForm(huh.NewGroup(
		huh.NewInput().Title("Name").Value(&n.Name).Validate(nonEmpty("a hackathon needs a name")),
		huh.NewInput().Title("Description").Value(&n.Description),
		huh.NewInput().Title("Starts").Placeholder("2026-10-03T09:00").Value(&n.Start).Validate(date),
		huh.NewInput().Title("Ends").Placeholder("2026-10-05T17:00").Value(&n.End).Validate(date),
		huh.NewInput().Title("Minutes between submissions").Value(&minutes).Validate(func(s string) error {
			v, err := strconv.Atoi(strings.TrimSpace(s))
			if err != nil || v <= 0 {
				return fmt.Errorf("minutes between submissions must be a positive number, got %q", s)
			}
			n.Frequency = v
			return nil
		}),
		huh.NewConfirm().Title("List it publicly?").Value(&n.Public),
	))
}

func nonEmpty(message string) func(string) error {
	return func(s string) error {
		if strings.TrimSpace(s) == "" {
			return errors.New(message)
		}
		return nil
	}
}

// Create makes the hackathon and reads it back, because create returns only an
// id and get is what carries the join codes. userName is the name to show on
// the organizer's membership: CLI tokens carry no profile of their own.
func Create(ctx context.Context, c *api.Client, n NewHackathon, userName string) (api.Hackathon, json.RawMessage, error) {
	args, err := n.Args()
	if err != nil {
		return api.Hackathon{}, nil, err
	}
	args["userName"] = userName

	var id string
	if err := c.Mutate(ctx, "hackathons:create", args, &id); err != nil {
		return api.Hackathon{}, nil, err
	}
	var raw json.RawMessage
	if err := c.Query(ctx, "hackathons:get", map[string]any{"hackathonId": id}, &raw); err != nil {
		return api.Hackathon{}, nil, err
	}
	var h api.Hackathon
	if err := json.Unmarshal(raw, &h); err != nil {
		return api.Hackathon{}, nil, err
	}
	return h, raw, nil
}

// joinURL is where a join code sends someone in a browser.
const joinURL = "https://hillpost.dev/join/"

// JoinLink is the page that joins a hackathon with this code.
func JoinLink(code string) string {
	if code == "" {
		return ""
	}
	return joinURL + code
}

// OrganizerName is the name to put on an organizer's membership: the account's
// own display name, which a fresh CLI-only account may not have yet.
func OrganizerName(ctx context.Context, c *api.Client) (string, error) {
	me, err := WhoAmI(ctx, c)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(me.UserName) == "" {
		return "", errors.New("your account has no display name yet, pass --as \"Your Name\"")
	}
	return me.UserName, nil
}
