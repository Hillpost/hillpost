package tui

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/Hillpost/hillpost/cli/internal/api"
	"github.com/Hillpost/hillpost/cli/internal/flow"
	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// JudgeData is everything the judge screen needs that has to be fetched first.
// The caller loads it once; the screen fetches only its own scores, and only
// for the submission being opened.
type JudgeData struct {
	HackathonName string
	JudgeID       string
	flow.JudgeContext
}

// Judge is the interactive scoring screen: a list of submissions on the left, the
// selected one on the right, and a scoring form for the one you open. It is a
// plain tea.Model so the dashboard can embed it.
//
//	tea.NewProgram(tui.NewJudge(client, data), tea.WithAltScreen()).Run()
func NewJudge(c *api.Client, data JudgeData) Judge {
	scored := make(map[string]bool, len(data.Submissions))
	for _, s := range data.Submissions {
		if flow.ScoredBy(s, data.JudgeID) {
			scored[s.ID] = true
		}
	}
	return Judge{client: c, data: data, scored: scored, exit: tea.Quit, width: 80, height: 24}
}

// Judge renders the scoring screen. Use NewJudge to build one.
type Judge struct {
	client *api.Client
	data   JudgeData
	scored map[string]bool

	// exit is what leaving the screen does: quit the program on its own,
	// or go back to the menu when the dashboard is showing it.
	exit tea.Cmd

	width, height int
	cursor        int

	// Scoring view. inputs is one per category plus a trailing feedback field.
	scoring bool
	loading bool
	inputs  []textinput.Model
	focus   int

	// Submission in flight: pending holds the category indexes still to send.
	pending   []int
	pendingAt int

	status string
	errMsg string
}

type myScoresMsg struct {
	submissionID string
	scores       []api.Score
	err          error
}

type scoreSavedMsg struct{ err error }

func (m Judge) Init() tea.Cmd { return textinput.Blink }

func (m Judge) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		return m, nil

	case myScoresMsg:
		m.loading = false
		if msg.err != nil {
			m.scoring = false
			m.errMsg = msg.err.Error()
			return m, nil
		}
		if msg.submissionID != m.currentID() {
			return m, nil // the user moved on while we were loading
		}
		m.fillInputs(msg.scores)
		return m, textinput.Blink

	case scoreSavedMsg:
		return m.saved(msg)

	case tea.KeyMsg:
		if m.pending != nil {
			return m, nil // do not touch the form mid-submit
		}
		if m.scoring {
			return m.updateScoring(msg)
		}
		return m.updateList(msg)
	}
	return m, nil
}

func (m Judge) updateList(key tea.KeyMsg) (tea.Model, tea.Cmd) {
	switch key.String() {
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.data.Submissions)-1 {
			m.cursor++
		}
	case "o":
		if s, ok := m.current(); ok {
			ui.OpenURL(s.ProjectURL)
			m.status = "Opened " + s.ProjectURL
		}
	case "enter":
		s, ok := m.current()
		if !ok {
			return m, nil
		}
		if len(m.data.Categories) == 0 {
			m.errMsg = "This hackathon has no scoring categories yet."
			return m, nil
		}
		m.scoring, m.loading, m.focus = true, true, 0
		m.status, m.errMsg = "", ""
		m.fillInputs(nil)
		return m, m.loadMyScores(s.ID)
	case "q", "esc":
		return m, m.exit
	case "ctrl+c":
		return m, tea.Quit
	}
	return m, nil
}

func (m Judge) updateScoring(key tea.KeyMsg) (tea.Model, tea.Cmd) {
	onFeedback := m.focus == len(m.inputs)-1

	switch key.String() {
	case "esc":
		m.scoring, m.loading = false, false
		m.inputs, m.errMsg = nil, ""
		return m, nil
	case "ctrl+c":
		return m, tea.Quit
	case "tab", "down":
		return m.moveFocus(1), textinput.Blink
	case "shift+tab", "up":
		return m.moveFocus(-1), textinput.Blink
	case "enter":
		if onFeedback {
			return m.submit()
		}
		return m.moveFocus(1), textinput.Blink
	case "s":
		if !onFeedback {
			return m.submit()
		}
	case "o":
		if !onFeedback {
			if s, ok := m.current(); ok {
				ui.OpenURL(s.ProjectURL)
			}
			return m, nil
		}
	case "q":
		if !onFeedback {
			return m, m.exit
		}
	}

	if m.loading || len(m.inputs) == 0 {
		return m, nil
	}
	var cmd tea.Cmd
	m.inputs[m.focus], cmd = m.inputs[m.focus].Update(key)
	if !onFeedback {
		m.inputs[m.focus].SetValue(digits(m.inputs[m.focus].Value()))
	}
	return m, cmd
}

// submit validates every filled score and starts sending them one at a time.
func (m Judge) submit() (tea.Model, tea.Cmd) {
	if m.loading {
		return m, nil
	}
	var pending []int
	for i, cat := range m.data.Categories {
		value := strings.TrimSpace(m.inputs[i].Value())
		if value == "" {
			continue
		}
		score, err := strconv.ParseFloat(value, 64)
		if err != nil {
			m.errMsg = cat.Name + ": " + value + " is not a number"
			return m, nil
		}
		if err := api.ValidateScore(score, cat.MaxScore); err != nil {
			m.errMsg = cat.Name + ": " + err.Error()
			return m, nil
		}
		pending = append(pending, i)
	}
	if len(pending) == 0 {
		m.errMsg = "Give at least one category a score."
		return m, nil
	}
	m.pending, m.pendingAt, m.errMsg = pending, 0, ""
	return m, m.sendScore(pending[0])
}

func (m Judge) saved(msg scoreSavedMsg) (tea.Model, tea.Cmd) {
	if msg.err != nil {
		m.pending, m.pendingAt = nil, 0
		m.errMsg = msg.err.Error()
		return m, nil
	}
	m.pendingAt++
	if m.pendingAt < len(m.pending) {
		return m, m.sendScore(m.pending[m.pendingAt])
	}

	count := len(m.pending)
	m.pending, m.pendingAt = nil, 0
	if s, ok := m.current(); ok {
		m.scored[s.ID] = true
		m.status = fmt.Sprintf("Saved %d %s for %s", count, plural("score", count), s.Name)
	}
	m.scoring, m.inputs = false, nil
	return m, nil
}

func (m Judge) sendScore(i int) tea.Cmd {
	submissionID := m.currentID()
	category := m.data.Categories[i]
	score, _ := strconv.ParseFloat(strings.TrimSpace(m.inputs[i].Value()), 64)
	feedback := strings.TrimSpace(m.inputs[len(m.inputs)-1].Value())
	client := m.client

	return func() tea.Msg {
		args := map[string]any{
			"submissionId": submissionID,
			"categoryId":   category.ID,
			"score":        score,
		}
		if feedback != "" {
			args["feedback"] = feedback
		}
		return scoreSavedMsg{err: client.Mutate(context.Background(), "scores:submit", args, nil)}
	}
}

func (m Judge) loadMyScores(submissionID string) tea.Cmd {
	client := m.client
	return func() tea.Msg {
		var scores []api.Score
		err := client.Query(context.Background(), "scores:getMyScoresForSubmission",
			map[string]any{"submissionId": submissionID}, &scores)
		return myScoresMsg{submissionID: submissionID, scores: scores, err: err}
	}
}

// fillInputs rebuilds the form, pre-filled with any scores I already gave.
func (m *Judge) fillInputs(mine []api.Score) {
	byCategory := make(map[string]api.Score, len(mine))
	for _, s := range mine {
		byCategory[s.CategoryID] = s
	}

	m.inputs = make([]textinput.Model, len(m.data.Categories)+1)
	feedback := ""
	for i, cat := range m.data.Categories {
		in := textinput.New()
		in.Prompt = ""
		in.CharLimit = 4
		in.Width = 5
		if existing, ok := byCategory[cat.ID]; ok {
			in.SetValue(ui.Number(existing.Score))
			if existing.Feedback != "" {
				feedback = existing.Feedback
			}
		}
		m.inputs[i] = in
	}

	note := textinput.New()
	note.Prompt = ""
	note.CharLimit = 500
	note.Width = 48
	note.Placeholder = "optional"
	note.SetValue(feedback)
	m.inputs[len(m.inputs)-1] = note

	m.focus = 0
	m.inputs[0].Focus()
}

func (m Judge) moveFocus(delta int) Judge {
	if len(m.inputs) == 0 {
		return m
	}
	m.inputs[m.focus].Blur()
	m.focus = (m.focus + delta + len(m.inputs)) % len(m.inputs)
	m.inputs[m.focus].Focus()
	return m
}

func (m Judge) current() (api.Submission, bool) {
	if m.cursor < 0 || m.cursor >= len(m.data.Submissions) {
		return api.Submission{}, false
	}
	return m.data.Submissions[m.cursor], true
}

func (m Judge) currentID() string {
	s, ok := m.current()
	if !ok {
		return ""
	}
	return s.ID
}

// View renders the whole screen, sized to the terminal (80x24 by default).
func (m Judge) View() string {
	title := ui.Title.Render("Judge")
	if m.data.HackathonName != "" {
		title += "  " + ui.Label.Render(m.data.HackathonName)
	}
	help := "j/k move   enter score   o open project   q quit"
	if m.scoring {
		help = "tab next   s submit   o open project   esc back"
	}
	return title + "\n\n" + m.body() + "\n" + m.footer(help)
}

// body is the screen without its title or footer, so the dashboard can put its
// own frame around it.
func (m Judge) body() string {
	if m.scoring {
		return m.scoringView()
	}
	return m.listView()
}

func (m Judge) footer(help string) string {
	switch {
	case m.pending != nil:
		return ui.Accent.Render(fmt.Sprintf("Saving %d of %d...", m.pendingAt+1, len(m.pending)))
	case m.errMsg != "":
		return ui.Danger.Render(m.errMsg)
	case m.status != "":
		return ui.Success.Render(m.status)
	}
	return ui.Label.Render(help)
}

func (m Judge) listView() string {
	if len(m.data.Submissions) == 0 {
		return ui.Label.Render("No submissions yet.")
	}

	listWidth := clamp(m.width/3, 24, 36)
	detailWidth := m.width - listWidth - 3
	rows := clamp(m.height-4, 3, len(m.data.Submissions))

	first := clamp(m.cursor-rows/2, 0, max(0, len(m.data.Submissions)-rows))
	var list strings.Builder
	for i := first; i < first+rows && i < len(m.data.Submissions); i++ {
		s := m.data.Submissions[i]
		mark := "[ ] "
		if m.scored[s.ID] {
			mark = "[x] "
		}
		line := truncate(mark+m.teamName(s)+" - "+s.Name, listWidth-2)
		if i == m.cursor {
			list.WriteString(ui.Accent.Render("> " + line))
		} else {
			list.WriteString(ui.Value.Render("  " + line))
		}
		list.WriteString("\n")
	}

	left := lipgloss.NewStyle().Width(listWidth).Render(strings.TrimRight(list.String(), "\n"))
	return lipgloss.JoinHorizontal(lipgloss.Top, left, ui.Label.Render(" | "), m.detailView(detailWidth))
}

func (m Judge) detailView(width int) string {
	s, ok := m.current()
	if !ok {
		return ""
	}
	wrap := lipgloss.NewStyle().Width(max(width, 20))

	out := []string{
		ui.Title.Render(truncate(s.Name, width)),
		ui.Label.Render(m.teamName(s) + "  iteration " + strconv.Itoa(s.SubmissionCount.Int()) + "  " + ui.Date(s.SubmittedAt)),
		"",
		wrap.Render(ui.Value.Render(s.Description)),
	}
	if s.WhatsNew != "" {
		out = append(out, "", ui.Header.Render("What is new"), wrap.Render(ui.Value.Render(s.WhatsNew)))
	}
	out = append(out, "")
	for _, link := range [][2]string{{"project", s.ProjectURL}, {"demo", s.DemoURL}, {"live", s.DeployedURL}} {
		if link[1] != "" {
			out = append(out, ui.Label.Render(link[0]+"  ")+ui.Value.Render(truncate(link[1], width-8)))
		}
	}
	return strings.Join(out, "\n")
}

func (m Judge) scoringView() string {
	s, _ := m.current()
	head := ui.Title.Render(truncate(s.Name, m.width)) + "\n" +
		ui.Label.Render(m.teamName(s)+"  iteration "+strconv.Itoa(s.SubmissionCount.Int())) + "\n\n"

	if m.loading {
		return head + ui.Label.Render("Loading your scores...")
	}

	labelWidth := 4
	for _, cat := range m.data.Categories {
		if len(cat.Name) > labelWidth {
			labelWidth = len(cat.Name)
		}
	}
	labelWidth = clamp(labelWidth, 4, 22)

	var b strings.Builder
	for i, cat := range m.data.Categories {
		b.WriteString(m.formRow(i, truncate(cat.Name, labelWidth), labelWidth))
		b.WriteString("  " + ui.Label.Render("/ "+ui.Number(cat.MaxScore)) + "\n")
	}
	b.WriteString("\n")
	b.WriteString(m.formRow(len(m.inputs)-1, "Feedback", labelWidth))
	return head + b.String()
}

func (m Judge) formRow(i int, label string, labelWidth int) string {
	marker := "  "
	style := ui.Label
	if i == m.focus {
		marker, style = ui.Accent.Render("> "), ui.Accent
	}
	pad := strings.Repeat(" ", max(0, labelWidth-len(label)))
	return marker + style.Render(label) + pad + "  " + m.inputs[i].View()
}

func (m Judge) teamName(s api.Submission) string {
	if name, ok := m.data.TeamNames[s.TeamID]; ok && name != "" {
		return name
	}
	return "unknown team"
}

func digits(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func truncate(s string, width int) string {
	if width <= 1 || lipgloss.Width(s) <= width {
		return s
	}
	runes := []rune(s)
	if len(runes) <= width {
		return s
	}
	return string(runes[:width-1]) + "~"
}

func plural(word string, n int) string {
	if n == 1 {
		return word
	}
	return word + "s"
}

func clamp(v, lo, hi int) int {
	if hi < lo {
		return lo
	}
	return min(max(v, lo), hi)
}
