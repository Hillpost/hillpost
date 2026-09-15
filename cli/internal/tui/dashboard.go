package tui

import (
	"context"
	"errors"
	"strconv"
	"strings"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/config"
	"github.com/Hillpost/hillpost/cli/internal/flow"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// RunDashboard opens the interactive dashboard, the screen `hillpost` shows
// when it is given no arguments. Callers must check for a terminal (ui.IsTTY).
func RunDashboard(c *api.Client, cfg config.Config) error {
	_, err := tea.NewProgram(NewDashboard(c, cfg), tea.WithAltScreen()).Run()
	return err
}

// NewDashboard builds the dashboard for a deployment. The client may carry no
// token: the dashboard then offers to log in.
func NewDashboard(c *api.Client, cfg config.Config) Dashboard {
	return Dashboard{client: c, cfg: cfg, width: 80, height: 24, busy: "Loading"}
}

// Dashboard is the home screen and the stack of screens opened from it. Home is
// the bottom of the stack: with no page pushed, the menu is what you see.
type Dashboard struct {
	client *api.Client
	cfg    config.Config

	width, height int
	showHelp      bool

	me      *api.WhoAmI    // nil until whoami answers, or when logged out
	current api.Membership // the hackathon every role-specific item acts on
	menu    []item
	cursor  int

	busy   string // what is loading, empty when idle
	status string
	errMsg string

	pages []page
}

// item is one line of the home menu. Its key says what opening it does; see
// Dashboard.open.
type item struct{ key, label string }

func (d Dashboard) Init() tea.Cmd { return d.loadHome() }

func (d Dashboard) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		d.width, d.height = msg.Width, msg.Height
		if p, ok := d.top(); ok {
			next, cmd := p.update(msg)
			d.pages[len(d.pages)-1] = next
			return d, cmd
		}
		return d, nil

	case homeMsg:
		d.busy = ""
		d.me, d.errMsg = msg.me, errorText(msg.err)
		d.selectCurrent()
		d.buildMenu()
		return d, nil

	case pageMsg:
		d.busy = ""
		if msg.err != nil {
			d.errMsg = msg.err.Error()
			return d, nil
		}
		d.errMsg, d.status = "", ""
		d.pages = append(d.pages, msg.page)
		return d, tea.Batch(msg.page.init(), d.tellSize())

	case doneMsg:
		d.busy = ""
		if msg.err != nil {
			d.errMsg = msg.err.Error()
			return d, nil
		}
		d.status = msg.status
		return d, nil

	case popMsg:
		d.busy = ""
		return d.pop(msg.status), nil

	case reloadMsg:
		d.busy, d.status, d.errMsg = "", msg.status, ""
		d.pages = nil
		if msg.hackathonID != "" {
			d.cfg.HackathonID, d.cfg.HackathonName = msg.hackathonID, msg.hackathonName
			if err := d.cfg.Save(); err != nil {
				d.errMsg = err.Error()
			}
		}
		d.busy = "Loading"
		return d, d.loadHome()

	case loggedInMsg:
		d.cfg.Token = msg.token
		d.client.Token = msg.token
		d.pages = nil
		if err := d.cfg.Save(); err != nil {
			d.errMsg = err.Error()
		}
		d.busy = "Loading your hackathons"
		return d, d.loadHome()

	case tea.KeyMsg:
		return d.updateKey(msg)
	}

	if p, ok := d.top(); ok {
		next, cmd := p.update(msg)
		d.pages[len(d.pages)-1] = next
		return d, cmd
	}
	return d, nil
}

func (d Dashboard) updateKey(key tea.KeyMsg) (tea.Model, tea.Cmd) {
	if key.Type == tea.KeyCtrlC {
		return d, tea.Quit
	}
	p, onPage := d.top()
	if key.String() == "?" && (!onPage || !p.textInput()) {
		d.showHelp = !d.showHelp
		return d, nil
	}
	if onPage {
		next, cmd := p.update(key)
		d.pages[len(d.pages)-1] = next
		return d, cmd
	}

	switch key.String() {
	case "up", "k":
		if d.cursor > 0 {
			d.cursor--
		}
	case "down", "j":
		if d.cursor < len(d.menu)-1 {
			d.cursor++
		}
	case "enter":
		if d.busy != "" || d.cursor >= len(d.menu) {
			return d, nil
		}
		return d.open(d.menu[d.cursor].key)
	case "q", "esc":
		return d, tea.Quit
	}
	return d, nil
}

// open runs the menu item named by key. Everything that needs the network is
// loaded in the background, so the menu never blocks.
func (d Dashboard) open(key string) (tea.Model, tea.Cmd) {
	c, id := d.client, d.current.HackathonID
	d.errMsg, d.status = "", ""

	switch key {
	case "login":
		d.busy = "Asking for a login code"
		return d, load(func(ctx context.Context) (page, error) {
			device, err := flow.StartLogin(ctx, c)
			if err != nil {
				return nil, err
			}
			ui.OpenURL(device.VerificationURL)
			return &loginScreen{client: c, device: device}, nil
		})

	case "logout":
		d.cfg.Token, d.client.Token, d.me = "", "", nil
		d.buildMenu()
		if err := d.cfg.Save(); err != nil {
			d.errMsg = err.Error()
			return d, nil
		}
		d.status = "Logged out."
		return d, nil

	case "switch":
		rows := make([]listRow, 0, len(d.me.Memberships))
		for _, m := range d.me.Memberships {
			rows = append(rows, listRow{id: m.HackathonID, name: m.Name, detail: m.Role})
		}
		d.pages = append(d.pages, &listPage{
			heading:  "Switch hackathon",
			rows:     rows,
			helpText: "enter use   esc back",
			onEnter: func(row listRow) tea.Cmd {
				return reload("Using "+row.name, row.id, row.name)
			},
		})
		return d, nil

	case "team":
		d.busy = "Loading your team"
		return d, load(func(ctx context.Context) (page, error) {
			team, err := flow.MyTeam(ctx, c, id)
			if err != nil {
				return nil, err
			}
			return &textPage{heading: "My team", body: teamView(team), helpText: "esc back"}, nil
		})

	case "submit":
		d.busy = "Loading your last submission"
		return d, load(func(ctx context.Context) (page, error) { return submitPage(ctx, c, id) })

	case "submissions":
		d.busy = "Loading submissions"
		return d, load(func(ctx context.Context) (page, error) {
			var submissions []api.Submission
			if err := c.Query(ctx, "submissions:list", map[string]any{"hackathonId": id}, &submissions); err != nil {
				return nil, err
			}
			var teams []api.Team
			if err := c.Query(ctx, "teams:list", map[string]any{"hackathonId": id}, &teams); err != nil {
				return nil, err
			}
			return &textPage{
				heading:  "Submissions",
				body:     flow.SubmissionsView(submissions, flow.TeamNames(teams)),
				helpText: "esc back",
			}, nil
		})

	case "leaderboard":
		d.busy = "Loading the leaderboard"
		return d, load(func(ctx context.Context) (page, error) { return leaderboardPage(ctx, c, id) })

	case "judge":
		d.busy = "Loading submissions to score"
		return d, load(func(ctx context.Context) (page, error) { return judgePage(ctx, c, id, d.current.Name) })

	case "overview":
		d.busy = "Loading the hackathon"
		return d, load(func(ctx context.Context) (page, error) {
			var h *api.Hackathon
			if err := c.Query(ctx, "hackathons:get", map[string]any{"hackathonId": id}, &h); err != nil {
				return nil, err
			}
			if h == nil {
				return nil, errors.New("this hackathon is gone")
			}
			return &textPage{heading: "Overview", body: overviewView(*h), helpText: "esc back"}, nil
		})

	case "categories":
		d.busy = "Loading categories"
		return d, load(func(ctx context.Context) (page, error) {
			var categories []api.Category
			if err := c.Query(ctx, "categories:list", map[string]any{"hackathonId": id}, &categories); err != nil {
				return nil, err
			}
			return &textPage{heading: "Categories", body: categoriesView(categories), helpText: "esc back"}, nil
		})

	case "members":
		d.busy = "Loading members"
		return d, load(func(ctx context.Context) (page, error) { return membersPage(ctx, c, id) })

	case "join":
		d.pages = append(d.pages, joinPage(c))
		return d, d.pages[len(d.pages)-1].init()

	case "discover":
		d.busy = "Loading public hackathons"
		return d, load(func(ctx context.Context) (page, error) { return discoverPage(ctx, c) })

	case "create":
		d.pages = append(d.pages, createPage(c))
		return d, d.pages[len(d.pages)-1].init()
	}
	return d, nil
}

// View draws the title, the current screen and one footer line.
func (d Dashboard) View() string {
	heading, help, body := "Hillpost", ui.Label.Render(d.homeHelp()), d.homeView()
	if p, ok := d.top(); ok {
		heading, help, body = p.title(), p.help(), p.view(d.width, d.bodyHeight())
	}

	head := ui.Title.Render(heading)
	if sub := d.subtitle(); sub != "" {
		head += "  " + ui.Label.Render(sub)
	}
	return head + "\n\n" + strings.TrimRight(body, "\n") + "\n\n" + d.footer(help)
}

func (d Dashboard) subtitle() string {
	if d.me == nil {
		return ""
	}
	parts := []string{d.me.UserName}
	if d.current.Name != "" {
		role := d.current.Role
		if d.current.Status != "" && d.current.Status != "approved" {
			role += ", " + d.current.Status
		}
		parts = append(parts, d.current.Name+" ("+role+")")
	}
	return strings.Join(parts, "  |  ")
}

func (d Dashboard) homeView() string {
	if d.busy != "" && d.me == nil {
		return ui.Label.Render(d.busy + "...")
	}

	var b strings.Builder
	if d.me == nil {
		b.WriteString(ui.Value.Render("Welcome to Hillpost. Log in to join, run and judge hackathons."))
		b.WriteString("\n\n")
	} else if d.current.Name == "" {
		b.WriteString(ui.Label.Render("No hackathon yet. Join one with a code, or discover a public one."))
		b.WriteString("\n\n")
	}

	for i, it := range d.menu {
		if i == d.cursor {
			b.WriteString(ui.Accent.Render("> "+it.label) + "\n")
			continue
		}
		b.WriteString(ui.Value.Render("  "+it.label) + "\n")
	}
	return b.String()
}

func (d Dashboard) homeHelp() string {
	if d.me == nil {
		return "enter select   q quit"
	}
	return "j/k move   enter open   ? help   q quit"
}

func (d Dashboard) footer(help string) string {
	switch {
	case d.busy != "":
		return ui.Accent.Render(d.busy + "...")
	case d.errMsg != "":
		return ui.Danger.Render(truncate(d.errMsg, d.width))
	case d.status != "":
		return ui.Success.Render(truncate(d.status, d.width))
	case d.showHelp:
		return ui.Label.Render("up/down or j/k move   enter select   esc back   q quit   ? hide help")
	}
	return help
}

// tellSize hands a freshly opened screen the size of the terminal, which it
// would otherwise only learn from the next resize.
func (d Dashboard) tellSize() tea.Cmd {
	width, height := d.width, d.height
	return func() tea.Msg { return tea.WindowSizeMsg{Width: width, Height: height} }
}

// bodyHeight is what is left for a screen after the title and footer.
func (d Dashboard) bodyHeight() int { return max(d.height-4, 3) }

func (d Dashboard) top() (page, bool) {
	if len(d.pages) == 0 {
		return nil, false
	}
	return d.pages[len(d.pages)-1], true
}

func (d Dashboard) pop(status string) Dashboard {
	if len(d.pages) > 0 {
		d.pages = d.pages[:len(d.pages)-1]
	}
	d.status, d.errMsg = status, ""
	return d
}

// selectCurrent picks the hackathon the role-specific menu items act on: the
// one `hillpost use` saved, else the first one I belong to.
func (d *Dashboard) selectCurrent() {
	d.current = api.Membership{}
	if d.me == nil {
		return
	}
	for _, m := range d.me.Memberships {
		if m.HackathonID == d.cfg.HackathonID {
			d.current = m
			return
		}
	}
	if d.cfg.HackathonID == "" && len(d.me.Memberships) > 0 {
		d.current = d.me.Memberships[0]
	}
}

// buildMenu lists what I can do here: what my role in the current hackathon
// allows, then what anyone logged in can do.
func (d *Dashboard) buildMenu() {
	d.menu = nil
	if d.me == nil {
		d.menu = []item{{"login", "Log in"}}
		d.cursor = 0
		return
	}

	switch d.current.Role {
	case "organizer":
		d.menu = append(d.menu,
			item{"overview", "Overview"},
			item{"categories", "Categories"},
			item{"members", "Members"},
			item{"submissions", "Submissions"},
			item{"leaderboard", "Leaderboard"})
	case "judge":
		d.menu = append(d.menu,
			item{"judge", "Judge submissions"},
			item{"leaderboard", "Leaderboard"})
	case "competitor":
		d.menu = append(d.menu,
			item{"team", "My team"},
			item{"submit", "Submit"},
			item{"submissions", "Submissions"},
			item{"leaderboard", "Leaderboard"})
	}
	if len(d.me.Memberships) > 1 {
		d.menu = append(d.menu, item{"switch", "Switch hackathon"})
	}
	d.menu = append(d.menu,
		item{"join", "Join a hackathon with a code"},
		item{"discover", "Discover public hackathons"},
		item{"create", "Create a hackathon"},
		item{"logout", "Log out"})

	d.cursor = clamp(d.cursor, 0, len(d.menu)-1)
}

// loadHome reads who I am and which hackathons I belong to.
func (d Dashboard) loadHome() tea.Cmd {
	c := d.client
	return func() tea.Msg {
		if c.Token == "" {
			return homeMsg{}
		}
		me, err := flow.WhoAmI(context.Background(), c)
		if err != nil {
			return homeMsg{err: err}
		}
		return homeMsg{me: &me}
	}
}

// The messages the dashboard itself handles. Screens send them to change what
// the whole dashboard is showing.
type (
	homeMsg struct {
		me  *api.WhoAmI
		err error
	}
	pageMsg struct {
		page page
		err  error
	}
	doneMsg struct {
		status string
		err    error
	}
	popMsg      struct{ status string }
	loggedInMsg struct{ token string }
	reloadMsg   struct {
		status        string
		hackathonID   string
		hackathonName string
	}
)

// load runs build in the background and pushes the screen it returns.
func load(build func(ctx context.Context) (page, error)) tea.Cmd {
	return func() tea.Msg {
		p, err := build(context.Background())
		return pageMsg{page: p, err: err}
	}
}

// act runs work in the background and shows what it returns in the footer.
func act(work func(ctx context.Context) (string, error)) tea.Cmd {
	return func() tea.Msg {
		status, err := work(context.Background())
		return doneMsg{status: status, err: err}
	}
}

// pop closes the top screen, leaving status in the footer.
func pop(status string) tea.Cmd {
	return func() tea.Msg { return popMsg{status: status} }
}

// reload goes back to a freshly loaded home, optionally with a new current
// hackathon.
func reload(status, hackathonID, hackathonName string) tea.Cmd {
	return func() tea.Msg {
		return reloadMsg{status: status, hackathonID: hackathonID, hackathonName: hackathonName}
	}
}

func errorText(err error) string {
	if err == nil {
		return ""
	}
	return err.Error()
}

func yesNo(b bool) string {
	if b {
		return "yes"
	}
	return "no"
}

func field(label, value string) string {
	return ui.Label.Render(label) + "  " + ui.Value.Render(value)
}

// teamView shows the team I am on, or how to get one.
func teamView(team *api.Team) string {
	if team == nil {
		return ui.Label.Render("You are not on a team yet. Create one with: hillpost team create <name>")
	}
	rows := make([][]string, 0, len(team.Members))
	for _, m := range team.Members {
		rows = append(rows, []string{m.UserName, m.Role, m.Status})
	}
	return ui.Title.Render(team.Name) + "\n" + field("team id", team.ID) + "\n\n" +
		ui.Table([]string{"MEMBER", "ROLE", "STATUS"}, rows)
}

// overviewView is the organizer's summary: when it runs, whether it is open,
// and the codes to hand out.
func overviewView(h api.Hackathon) string {
	lines := []string{
		ui.Title.Render(h.Name),
		"",
		field("runs       ", ui.Date(h.StartDate)+" to "+ui.Date(h.EndDate)),
		field("every      ", strconv.Itoa(h.SubmissionFrequencyMinutes.Int())+" minutes between submissions"),
		field("active     ", yesNo(h.IsActive)),
		field("public     ", yesNo(h.IsPublic)),
		field("id         ", h.ID),
	}
	if h.JudgeJoinCode == "" {
		return strings.Join(lines, "\n") + "\n\n" + ui.Label.Render("Only organizers can see the join codes.")
	}
	return strings.Join(lines, "\n") + "\n\n" +
		field("competitor ", ui.Code.Render(h.CompetitorJoinCode)+"  "+flow.JoinLink(h.CompetitorJoinCode)) + "\n" +
		field("judge      ", ui.Code.Render(h.JudgeJoinCode)+"  "+flow.JoinLink(h.JudgeJoinCode))
}

func categoriesView(categories []api.Category) string {
	if len(categories) == 0 {
		return ui.Label.Render("No categories yet. Add one: hillpost host categories add <name> --max 10")
	}
	rows := make([][]string, 0, len(categories))
	for _, cat := range categories {
		rows = append(rows, []string{cat.Name, ui.Number(cat.MaxScore), cat.Description})
	}
	return ui.Table([]string{"NAME", "MAX", "DESCRIPTION"}, rows)
}
