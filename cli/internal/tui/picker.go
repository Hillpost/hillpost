// Package tui holds the CLI's interactive bubbletea screens.
package tui

import (
	tea "github.com/charmbracelet/bubbletea"

	"github.com/Hillpost/hillpost/cli/internal/ui"
)

// Pick asks the user to choose one of items, showing label(item) for each.
// It returns the chosen item, or ok == false if the user cancelled.
// Callers must check for a terminal (ui.IsTTY) before calling it.
func Pick[T any](title string, items []T, label func(T) string) (chosen T, ok bool, err error) {
	if len(items) == 0 {
		return chosen, false, nil
	}

	lines := make([]string, len(items))
	for i, item := range items {
		lines[i] = label(item)
	}

	final, err := tea.NewProgram(picker{title: title, lines: lines}).Run()
	if err != nil {
		return chosen, false, err
	}
	m := final.(picker)
	if !m.chosen {
		return chosen, false, nil
	}
	return items[m.cursor], true, nil
}

type picker struct {
	title  string
	lines  []string
	cursor int
	chosen bool
}

func (m picker) Init() tea.Cmd { return nil }

func (m picker) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	key, isKey := msg.(tea.KeyMsg)
	if !isKey {
		return m, nil
	}
	switch key.String() {
	case "up", "k":
		if m.cursor > 0 {
			m.cursor--
		}
	case "down", "j":
		if m.cursor < len(m.lines)-1 {
			m.cursor++
		}
	case "enter":
		m.chosen = true
		return m, tea.Quit
	case "q", "esc", "ctrl+c":
		return m, tea.Quit
	}
	return m, nil
}

func (m picker) View() string {
	if m.chosen {
		return ""
	}
	out := ui.Title.Render(m.title) + "\n\n"
	for i, line := range m.lines {
		if i == m.cursor {
			out += ui.Accent.Render("> "+line) + "\n"
			continue
		}
		out += ui.Value.Render("  "+line) + "\n"
	}
	return out + "\n" + ui.Label.Render("up/down to move, enter to select, q to cancel") + "\n"
}
