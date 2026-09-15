package tui

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"

	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// Watch redraws whatever render returns, refreshing it every interval until the
// user presses q. It is what `hillpost leaderboard --watch` is built from.
// Callers must check for a terminal (ui.IsTTY) before calling it.
func Watch(interval time.Duration, render func() (string, error)) error {
	first, err := render()
	if err != nil {
		return err
	}
	final, err := tea.NewProgram(watcher{
		interval: interval,
		render:   render,
		body:     first,
	}, tea.WithAltScreen()).Run()
	if err != nil {
		return err
	}
	return final.(watcher).err
}

type frameMsg struct {
	body string
	err  error
}

type watcher struct {
	interval time.Duration
	render   func() (string, error)
	body     string
	err      error
}

func (m watcher) Init() tea.Cmd { return m.tick() }

func (m watcher) tick() tea.Cmd {
	return tea.Tick(m.interval, func(time.Time) tea.Msg {
		body, err := m.render()
		return frameMsg{body: body, err: err}
	})
}

func (m watcher) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case frameMsg:
		// A single failed refresh is not worth throwing the view away; keep the
		// last good body on screen and try again.
		if msg.err == nil {
			m.body = msg.body
		}
		return m, m.tick()
	case tea.KeyMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return m, tea.Quit
		}
	}
	return m, nil
}

func (m watcher) View() string {
	return strings.TrimRight(m.body, "\n") + "\n\n" + ui.Label.Render("refreshing every "+m.interval.String()+", q to quit") + "\n"
}
