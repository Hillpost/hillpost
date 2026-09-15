package tui

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/huh"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/flow"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// page is one screen opened from the dashboard menu. A page owns its keys: the
// dashboard only takes ctrl+c, and "?" when the page is not taking text. help
// is the footer line, already styled, so a screen can colour its own errors.
type page interface {
	title() string
	help() string
	textInput() bool
	init() tea.Cmd
	update(tea.Msg) (page, tea.Cmd)
	view(width, height int) string
}

// listPage is a cursor over rows, with enter and any number of extra keys
// bound to actions on the row under the cursor.
type listPage struct {
	heading  string
	rows     []listRow
	cursor   int
	empty    string
	helpText string
	onEnter  func(listRow) tea.Cmd
	actions  map[string]func(listRow) tea.Cmd
}

// listRow is one line: a name, and a detail shown after it that an action may
// change, such as a member's status.
type listRow struct{ id, name, detail string }

// rowDetailMsg changes one row's detail once the backend has agreed.
type rowDetailMsg struct {
	id     string
	detail string
}

func (p *listPage) title() string   { return p.heading }
func (p *listPage) help() string    { return ui.Label.Render(p.helpText) }
func (p *listPage) textInput() bool { return false }
func (p *listPage) init() tea.Cmd   { return nil }

func (p *listPage) update(msg tea.Msg) (page, tea.Cmd) {
	switch msg := msg.(type) {
	case rowDetailMsg:
		for i, row := range p.rows {
			if row.id == msg.id {
				p.rows[i].detail = msg.detail
			}
		}
		return p, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			p.cursor = max(p.cursor-1, 0)
		case "down", "j":
			p.cursor = min(p.cursor+1, max(len(p.rows)-1, 0))
		case "esc", "q":
			return p, pop("")
		case "enter":
			if p.onEnter != nil && p.cursor < len(p.rows) {
				return p, p.onEnter(p.rows[p.cursor])
			}
		default:
			if action, ok := p.actions[msg.String()]; ok && p.cursor < len(p.rows) {
				return p, action(p.rows[p.cursor])
			}
		}
	}
	return p, nil
}

func (p *listPage) view(width, height int) string {
	if len(p.rows) == 0 {
		return ui.Label.Render(p.empty)
	}

	nameWidth := 0
	for _, row := range p.rows {
		nameWidth = max(nameWidth, len(row.name))
	}
	nameWidth = clamp(nameWidth, 4, width/2)

	first := clamp(p.cursor-height/2, 0, max(0, len(p.rows)-height))
	var b strings.Builder
	for i := first; i < first+height && i < len(p.rows); i++ {
		row := p.rows[i]
		line := truncate(row.name, nameWidth)
		line += strings.Repeat(" ", max(0, nameWidth-len(line)))
		if row.detail != "" {
			line += "  " + row.detail
		}
		if i == p.cursor {
			b.WriteString(ui.Accent.Render("> "+truncate(line, width-2)) + "\n")
			continue
		}
		b.WriteString(ui.Value.Render("  "+truncate(line, width-2)) + "\n")
	}
	return b.String()
}

// textPage shows a rendered block of text, scrolled a line at a time. A page
// with a refresh can reload itself with "r".
type textPage struct {
	heading  string
	body     string
	offset   int
	helpText string
	refresh  func() tea.Cmd
}

// bodyMsg replaces a text page's body. It names its page, so a refresh that
// arrives after the user has moved on is ignored.
type bodyMsg struct {
	heading string
	body    string
}

func (p *textPage) title() string   { return p.heading }
func (p *textPage) help() string    { return ui.Label.Render(p.helpText) }
func (p *textPage) textInput() bool { return false }
func (p *textPage) init() tea.Cmd   { return nil }

func (p *textPage) update(msg tea.Msg) (page, tea.Cmd) {
	switch msg := msg.(type) {
	case bodyMsg:
		if msg.heading == p.heading {
			p.body = msg.body
		}
		return p, nil

	case tea.KeyMsg:
		switch msg.String() {
		case "up", "k":
			p.offset = max(p.offset-1, 0)
		case "down", "j":
			p.offset = min(p.offset+1, max(len(p.lines())-1, 0))
		case "r":
			if p.refresh != nil {
				return p, p.refresh()
			}
		case "esc", "q":
			return p, pop("")
		}
	}
	return p, nil
}

func (p *textPage) lines() []string { return strings.Split(strings.TrimRight(p.body, "\n"), "\n") }

func (p *textPage) view(_, height int) string {
	lines := p.lines()
	offset := clamp(p.offset, 0, max(0, len(lines)-height))
	end := min(offset+height, len(lines))
	return strings.Join(lines[offset:end], "\n")
}

// formPage shows a huh form. The form's SubmitCmd is what the flow does with
// the answers; esc leaves without sending anything.
type formPage struct {
	heading  string
	form     *huh.Form
	helpText string
}

func (p *formPage) title() string   { return p.heading }
func (p *formPage) help() string    { return ui.Label.Render(p.helpText) }
func (p *formPage) textInput() bool { return true }
func (p *formPage) init() tea.Cmd   { return p.form.Init() }

func (p *formPage) update(msg tea.Msg) (page, tea.Cmd) {
	if key, ok := msg.(tea.KeyMsg); ok && key.Type == tea.KeyEscape {
		return p, pop("")
	}
	form, cmd := p.form.Update(msg)
	if f, ok := form.(*huh.Form); ok {
		p.form = f
	}
	return p, cmd
}

func (p *formPage) view(_, _ int) string { return p.form.View() }

// judgeScreen is the scoring screen from `hillpost judge`, shown inside the
// dashboard: q and esc go back to the menu instead of quitting.
type judgeScreen struct{ judge Judge }

func (p *judgeScreen) title() string { return "Judge" }

func (p *judgeScreen) help() string {
	help := "j/k move   enter score   o open project   esc back"
	if p.judge.scoring {
		help = "tab next   s submit   o open project   esc back"
	}
	return p.judge.footer(help)
}

func (p *judgeScreen) textInput() bool { return p.judge.scoring }
func (p *judgeScreen) init() tea.Cmd   { return p.judge.Init() }

func (p *judgeScreen) update(msg tea.Msg) (page, tea.Cmd) {
	model, cmd := p.judge.Update(msg)
	if j, ok := model.(Judge); ok {
		p.judge = j
	}
	return p, cmd
}

func (p *judgeScreen) view(_, _ int) string { return p.judge.body() }

// loginScreen runs the device flow: it shows the code, then asks the backend
// every interval whether the browser has approved it.
type loginScreen struct {
	client *api.Client
	device api.DeviceLogin
	status string
	errMsg string
}

// claimMsg is one answer to "has this device been approved yet?".
type claimMsg struct {
	deviceCode string
	claim      api.DeviceClaim
	err        error
}

func (p *loginScreen) title() string   { return "Log in" }
func (p *loginScreen) help() string    { return ui.Label.Render("o open the browser again   esc cancel") }
func (p *loginScreen) textInput() bool { return false }
func (p *loginScreen) init() tea.Cmd   { return p.poll() }

func (p *loginScreen) poll() tea.Cmd {
	c, device := p.client, p.device
	return tea.Tick(flow.PollInterval(device), func(_ time.Time) tea.Msg {
		claim, err := flow.Claim(context.Background(), c, device.DeviceCode)
		return claimMsg{deviceCode: device.DeviceCode, claim: claim, err: err}
	})
}

func (p *loginScreen) update(msg tea.Msg) (page, tea.Cmd) {
	switch msg := msg.(type) {
	case claimMsg:
		if msg.deviceCode != p.device.DeviceCode {
			return p, nil
		}
		switch {
		case msg.err != nil:
			p.errMsg = msg.err.Error()
			return p, nil
		case msg.claim.Status == "approved":
			return p, func() tea.Msg { return loggedInMsg{token: msg.claim.Token} }
		case msg.claim.Status == "expired":
			p.errMsg = flow.ErrLoginExpired.Error()
			return p, nil
		}
		p.status = "Waiting for you to approve this terminal"
		return p, p.poll()

	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "q":
			return p, pop("")
		case "o":
			ui.OpenURL(p.device.VerificationURL)
		}
	}
	return p, nil
}

func (p *loginScreen) view(width, _ int) string {
	lines := []string{
		ui.Value.Render("Approve this terminal in your browser."),
		"",
		field("code", ui.Code.Render(p.device.UserCode)),
		field("open", truncate(p.device.VerificationURL, max(width-8, 20))),
		"",
	}
	switch {
	case p.errMsg != "":
		lines = append(lines, ui.Danger.Render(p.errMsg))
	case p.status != "":
		lines = append(lines, ui.Label.Render(p.status+"..."))
	default:
		lines = append(lines, ui.Label.Render("Waiting..."))
	}
	return strings.Join(lines, "\n")
}

// The screens that need data before they can be built. Each one runs in the
// background, off the menu, and is pushed when it is ready.

func submitPage(ctx context.Context, c *api.Client, hackathonID string) (page, error) {
	team, err := flow.MyTeam(ctx, c, hackathonID)
	if err != nil {
		return nil, err
	}
	if team == nil {
		return nil, errors.New("you are not on a team yet, run: hillpost team create <name>")
	}
	latest, err := flow.LatestSubmission(ctx, c, hackathonID, team.ID)
	if err != nil {
		return nil, err
	}

	p := new(flow.Project)
	form := flow.SubmitForm(p, latest)
	form.SubmitCmd = func() tea.Msg {
		saved, _, err := flow.Submit(context.Background(), c, hackathonID, team.ID, *p)
		if err != nil {
			return doneMsg{err: err}
		}
		return popMsg{status: "Submitted " + saved.Name + " as #" + strconv.Itoa(saved.SubmissionCount.Int())}
	}
	form.CancelCmd = pop("")
	return &formPage{heading: "Submit for " + team.Name, form: form, helpText: "enter next   esc back"}, nil
}

func joinPage(c *api.Client) page {
	var code string
	form := huh.NewForm(huh.NewGroup(
		huh.NewInput().Title("Join code").Placeholder("6 characters from the organizer").Value(&code),
	))
	form.SubmitCmd = func() tea.Msg {
		joined, err := flow.Join(context.Background(), c, strings.TrimSpace(code))
		if err != nil {
			return doneMsg{err: err}
		}
		status := "Joined " + joined.Hackathon.Name + " as " + joined.Role
		if joined.AlreadyMember {
			status = "Already a member of " + joined.Hackathon.Name
		} else if joined.Role == "judge" {
			status += ", waiting for an organizer to approve you"
		}
		return reloadMsg{status: status, hackathonID: joined.Hackathon.ID, hackathonName: joined.Hackathon.Name}
	}
	form.CancelCmd = pop("")
	return &formPage{heading: "Join a hackathon", form: form, helpText: "enter join   esc back"}
}

func createPage(c *api.Client) page {
	n := new(flow.NewHackathon)
	form := flow.CreateForm(n)
	form.SubmitCmd = func() tea.Msg {
		ctx := context.Background()
		name, err := flow.OrganizerName(ctx, c)
		if err != nil {
			return doneMsg{err: err}
		}
		h, _, err := flow.Create(ctx, c, *n, name)
		if err != nil {
			return doneMsg{err: err}
		}
		return reloadMsg{status: "Created " + h.Name, hackathonID: h.ID, hackathonName: h.Name}
	}
	form.CancelCmd = pop("")
	return &formPage{heading: "Create a hackathon", form: form, helpText: "enter next   esc back"}
}

func discoverPage(ctx context.Context, c *api.Client) (page, error) {
	var hackathons []api.Hackathon
	if err := c.Query(ctx, "hackathons:listPublic", nil, &hackathons); err != nil {
		return nil, err
	}
	rows := make([]listRow, 0, len(hackathons))
	for _, h := range hackathons {
		rows = append(rows, listRow{
			id:     h.ID,
			name:   h.Name,
			detail: ui.Label.Render(ui.Date(h.StartDate) + " to " + ui.Date(h.EndDate)),
		})
	}
	return &listPage{
		heading:  "Public hackathons",
		rows:     rows,
		empty:    "No public hackathons are open right now.",
		helpText: "j/k move   enter join   esc back",
		onEnter: func(row listRow) tea.Cmd {
			return func() tea.Msg {
				joined, err := flow.JoinPublic(context.Background(), c, row.id)
				if err != nil {
					return doneMsg{err: err}
				}
				status := "Joined " + joined.Hackathon.Name
				if joined.AlreadyMember {
					status = "Already a member of " + joined.Hackathon.Name
				}
				return reloadMsg{status: status, hackathonID: joined.Hackathon.ID, hackathonName: joined.Hackathon.Name}
			}
		},
	}, nil
}

func membersPage(ctx context.Context, c *api.Client, hackathonID string) (page, error) {
	var members []api.Member
	if err := c.Query(ctx, "members:listMembers", map[string]any{"hackathonId": hackathonID}, &members); err != nil {
		return nil, err
	}
	if members == nil {
		return nil, errors.New("Only organizers can see the member list")
	}

	rows := make([]listRow, 0, len(members))
	for _, m := range members {
		rows = append(rows, listRow{id: m.ID, name: m.UserName, detail: memberDetail(m.Role, m.Status)})
	}
	setStatus := func(status string) func(listRow) tea.Cmd {
		return func(row listRow) tea.Cmd {
			role := strings.Fields(row.detail)[0]
			return func() tea.Msg {
				err := c.Mutate(context.Background(), "members:updateStatus",
					map[string]any{"memberId": row.id, "status": status}, nil)
				if err != nil {
					return doneMsg{err: err}
				}
				return rowDetailMsg{id: row.id, detail: memberDetail(role, status)}
			}
		}
	}
	return &listPage{
		heading:  "Members",
		rows:     rows,
		empty:    "Nobody has joined yet.",
		helpText: "j/k move   a approve   r reject   esc back",
		actions:  map[string]func(listRow) tea.Cmd{"a": setStatus("approved"), "r": setStatus("rejected")},
	}, nil
}

// memberDetail lines every member's status up under the one above.
func memberDetail(role, status string) string {
	return role + strings.Repeat(" ", max(0, 12-len(role))) + status
}

func leaderboardPage(ctx context.Context, c *api.Client, hackathonID string) (page, error) {
	board, err := flow.LoadLeaderboard(ctx, c, hackathonID)
	if err != nil {
		return nil, err
	}
	return &textPage{
		heading:  "Leaderboard",
		body:     flow.LeaderboardView(board),
		helpText: "r refresh   esc back",
		refresh: func() tea.Cmd {
			return func() tea.Msg {
				board, err := flow.LoadLeaderboard(context.Background(), c, hackathonID)
				if err != nil {
					return doneMsg{err: err}
				}
				return bodyMsg{heading: "Leaderboard", body: flow.LeaderboardView(board)}
			}
		},
	}, nil
}

func judgePage(ctx context.Context, c *api.Client, hackathonID, hackathonName string) (page, error) {
	me, err := flow.WhoAmI(ctx, c)
	if err != nil {
		return nil, err
	}
	judging, err := flow.LoadJudgeContext(ctx, c, hackathonID)
	if err != nil {
		return nil, err
	}
	if len(judging.Submissions) == 0 {
		return nil, errors.New("no submissions to score yet")
	}

	judge := NewJudge(c, JudgeData{
		HackathonName: hackathonName,
		JudgeID:       me.UserID,
		JudgeContext:  judging,
	})
	judge.exit = pop("")
	return &judgeScreen{judge: judge}, nil
}
