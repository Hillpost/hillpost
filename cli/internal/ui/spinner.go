package ui

import (
	"fmt"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

// Spin runs work in the background while a spinner labelled message is shown,
// and returns work's error. Without a terminal it prints the message once and
// runs work directly.
func Spin(message string, work func() error) error {
	if !IsTTY() {
		fmt.Println(message)
		return work()
	}

	done := make(chan error, 1)
	go func() { done <- work() }()

	m := spinnerModel{message: message, done: done}
	m.spinner = spinner.New(spinner.WithSpinner(spinner.Dot), spinner.WithStyle(Accent))

	final, err := tea.NewProgram(m).Run()
	if err != nil {
		// The terminal is unusable; fall back to the result of work.
		return <-done
	}
	return final.(spinnerModel).err
}

type doneMsg struct{ err error }

type spinnerModel struct {
	message string
	spinner spinner.Model
	done    chan error
	err     error
}

func (m spinnerModel) Init() tea.Cmd {
	return tea.Batch(m.spinner.Tick, func() tea.Msg { return doneMsg{err: <-m.done} })
}

func (m spinnerModel) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case doneMsg:
		m.err = msg.err
		return m, tea.Quit
	case tea.KeyMsg:
		if msg.Type == tea.KeyCtrlC {
			m.err = fmt.Errorf("cancelled")
			return m, tea.Quit
		}
	}
	var cmd tea.Cmd
	m.spinner, cmd = m.spinner.Update(msg)
	return m, cmd
}

func (m spinnerModel) View() string {
	if m.err != nil {
		return ""
	}
	return m.spinner.View() + Label.Render(m.message) + "\n"
}
