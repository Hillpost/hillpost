package flow

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"github.com/charmbracelet/huh"

	"github.com/Hillpost/hillpost/cli/internal/api"
)

// Project is one submission as the user is editing it, before it is sent.
type Project struct {
	Name        string
	Description string
	ProjectURL  string
	DemoURL     string
	DeployedURL string
	WhatsNew    string
}

// Missing names the required fields that are still empty, spelled as the flags
// that fill them so an error can tell the user exactly what to add.
func (p Project) Missing() []string {
	var missing []string
	for _, f := range []struct {
		flag  string
		value string
	}{
		{"--name", p.Name},
		{"--description", p.Description},
		{"--url", p.ProjectURL},
	} {
		if strings.TrimSpace(f.value) == "" {
			missing = append(missing, f.flag)
		}
	}
	return missing
}

// Prefill fills p's empty fields from the team's last submission, so
// resubmitting only means saying what changed.
func Prefill(p Project, latest *api.Submission) Project {
	if latest == nil {
		return p
	}
	for _, f := range []struct {
		field *string
		value string
	}{
		{&p.Name, latest.Name},
		{&p.Description, latest.Description},
		{&p.ProjectURL, latest.ProjectURL},
		{&p.DemoURL, latest.DemoURL},
		{&p.DeployedURL, latest.DeployedURL},
	} {
		if *f.field == "" {
			*f.field = f.value
		}
	}
	return p
}

// SubmitForm builds the submission form over p, pre-filled from the team's last
// submission. Run it with form.Run(), or embed it in a bubbletea model by
// setting its SubmitCmd and CancelCmd. p is written as the user types.
func SubmitForm(p *Project, latest *api.Submission) *huh.Form {
	*p = Prefill(*p, latest)

	fields := []huh.Field{
		huh.NewInput().Title("Project name").Value(&p.Name),
		huh.NewText().Title("Description").Value(&p.Description),
		huh.NewInput().Title("Source code URL").Placeholder("https://github.com/...").Value(&p.ProjectURL),
		huh.NewInput().Title("Demo video URL").Description("optional").Value(&p.DemoURL),
		huh.NewInput().Title("Deployed URL").Description("optional").Value(&p.DeployedURL),
	}
	if latest != nil {
		fields = append(fields, huh.NewText().
			Title("What is new").
			Description("shown to judges alongside submission #"+strconv.Itoa(latest.SubmissionCount.Int()+1)).
			Value(&p.WhatsNew))
	}
	return huh.NewForm(huh.NewGroup(fields...))
}

// ErrIncomplete is what a half-filled submission form comes back with.
var ErrIncomplete = errors.New("a submission needs a name, a description and a source code URL")

// Submit sends the project and reads the saved submission back, because the
// mutation returns only an id and the user wants to see its number.
func Submit(ctx context.Context, c *api.Client, hackathonID, teamID string, p Project) (api.Submission, json.RawMessage, error) {
	if len(p.Missing()) > 0 {
		return api.Submission{}, nil, ErrIncomplete
	}

	args := map[string]any{
		"hackathonId": hackathonID,
		"teamId":      teamID,
		"name":        p.Name,
		"description": p.Description,
		"projectUrl":  p.ProjectURL,
	}
	// Convex rejects an explicit empty string where it expects an optional
	// field, so only send the ones the user filled in.
	for key, value := range map[string]string{
		"demoUrl":     p.DemoURL,
		"deployedUrl": p.DeployedURL,
		"whatsNew":    p.WhatsNew,
	} {
		if v := strings.TrimSpace(value); v != "" {
			args[key] = v
		}
	}

	var submissionID string
	if err := c.Mutate(ctx, "submissions:create", args, &submissionID); err != nil {
		return api.Submission{}, nil, err
	}
	var raw json.RawMessage
	if err := c.Query(ctx, "submissions:get", map[string]any{"submissionId": submissionID}, &raw); err != nil {
		return api.Submission{}, nil, err
	}
	var saved api.Submission
	if err := json.Unmarshal(raw, &saved); err != nil {
		return api.Submission{}, nil, err
	}
	return saved, raw, nil
}

// LatestSubmission is the team's last submission, or nil before their first.
func LatestSubmission(ctx context.Context, c *api.Client, hackathonID, teamID string) (*api.Submission, error) {
	var latest *api.Submission
	err := c.Query(ctx, "submissions:getLatestForTeam", map[string]any{
		"hackathonId": hackathonID,
		"teamId":      teamID,
	}, &latest)
	return latest, err
}

// MyTeam is the team I am on in this hackathon, or nil when I am on none.
func MyTeam(ctx context.Context, c *api.Client, hackathonID string) (*api.Team, error) {
	var team *api.Team
	err := c.Query(ctx, "teams:getMyTeam", map[string]any{"hackathonId": hackathonID}, &team)
	return team, err
}
