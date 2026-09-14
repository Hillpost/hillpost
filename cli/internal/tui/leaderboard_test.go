package tui

import (
	"errors"
	"strings"
	"testing"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func newWatcher(body string) watcher {
	return watcher{interval: 5 * time.Second, render: func() (string, error) { return body, nil }, body: body}
}

func TestWatcherKeepsLastGoodBodyOnFailure(t *testing.T) {
	m, _ := newWatcher("first").Update(frameMsg{body: "second"})
	if got := m.(watcher).body; got != "second" {
		t.Errorf("a good frame should replace the body, got %q", got)
	}

	m, cmd := m.Update(frameMsg{err: errors.New("network is down")})
	if got := m.(watcher).body; got != "second" {
		t.Errorf("a failed refresh must not blank the view, got %q", got)
	}
	if cmd == nil {
		t.Error("a failed refresh must still schedule the next one")
	}
}

func TestWatcherQuitsOnQ(t *testing.T) {
	for _, key := range []string{"q", "esc", "ctrl+c"} {
		_, cmd := newWatcher("body").Update(tea.KeyMsg(tea.Key{Type: tea.KeyRunes, Runes: []rune(key)}))
		if key == "q" && cmd == nil {
			t.Errorf("%q should quit", key)
		}
	}
	if _, cmd := newWatcher("body").Update(tea.KeyMsg(tea.Key{Type: tea.KeyEsc})); cmd == nil {
		t.Error("esc should quit")
	}
}

func TestWatcherViewShowsTheRefreshHint(t *testing.T) {
	view := newWatcher("TEAM\nOtters\n\n\n").View()
	if strings.Contains(view, "Otters\n\n\n\n") {
		t.Error("trailing blank lines should be trimmed before the hint")
	}
	if !strings.Contains(view, "5s") || !strings.Contains(view, "q to quit") {
		t.Errorf("view should say how to quit and how often it refreshes, got %q", view)
	}
}
